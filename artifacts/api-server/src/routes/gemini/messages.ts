import { Router } from "express";
import { db, messages, conversations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  ListGeminiMessagesParams,
  SendGeminiMessageParams,
  SendGeminiMessageBody,
} from "@workspace/api-zod";

const SUPPORTED_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
];

const DEFAULT_MODEL = "gemini-3-flash-preview";

const router = Router();

router.get("/conversations/:id/messages", async (req, res) => {
  const parsed = ListGeminiMessagesParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, parsed.data.id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/conversations/:id/messages", async (req, res) => {
  const paramsParsed = SendGeminiMessageParams.safeParse({
    id: req.params.id,
  });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = SendGeminiMessageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const conversationId = paramsParsed.data.id;
  const {
    content: userContent,
    model: requestedModel,
    systemPrompt,
    imageData,
    imageMimeType,
  } = bodyParsed.data;

  const model =
    requestedModel && SUPPORTED_MODELS.includes(requestedModel)
      ? requestedModel
      : DEFAULT_MODEL;

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({
    conversationId,
    role: "user",
    content: userContent,
    imageData: imageData ?? null,
    imageMimeType: imageMimeType ?? null,
  });

  const existingMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const contents = existingMessages.map((m) => {
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      if (m.imageData && m.imageMimeType) {
        parts.push({
          inlineData: { mimeType: m.imageMimeType, data: m.imageData },
        });
      }

      parts.push({ text: m.content });

      return {
        role: m.role === "assistant" ? "model" : "user",
        parts,
      };
    });

    const config: Record<string, unknown> = { maxOutputTokens: 8192 };
    if (systemPrompt) {
      config.systemInstruction = systemPrompt;
    }

    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config,
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    req.log.error({ error }, "Error generating content");
    res.write(
      `data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`
    );
    res.end();
  }
});

export default router;

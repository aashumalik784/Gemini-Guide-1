import { Router } from "express";
import { db, conversations, messages } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateGeminiConversationBody,
  GetGeminiConversationParams,
  DeleteGeminiConversationParams,
  UpdateGeminiConversationBody,
} from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

router.get("/conversations", async (req, res) => {
  const allConversations = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt));
  res.json(allConversations);
});

router.post("/conversations", async (req, res) => {
  const parsed = CreateGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [conversation] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();
  res.status(201).json(conversation);
});

router.get("/conversations/:id", async (req, res) => {
  const parsed = GetGeminiConversationParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const id = parsed.data.id;
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);
  res.json({ ...conversation, messages: msgs });
});

router.patch("/conversations/:id", async (req, res) => {
  const parsed = GetGeminiConversationParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateGeminiConversationBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const id = parsed.data.id;
  const [updated] = await db
    .update(conversations)
    .set({ title: bodyParsed.data.title })
    .where(eq(conversations.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(updated);
});

router.delete("/conversations/:id", async (req, res) => {
  const parsed = DeleteGeminiConversationParams.safeParse({
    id: req.params.id,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const id = parsed.data.id;
  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!existing) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
  res.status(204).send();
});

router.post("/conversations/:id/auto-title", async (req, res) => {
  const parsed = GetGeminiConversationParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const id = parsed.data.id;

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  if (msgs.length === 0) {
    res.json({ title: "New Conversation" });
    return;
  }

  const context = msgs
    .slice(0, 4)
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Generate a very short, descriptive title (max 6 words) for this conversation. Reply with ONLY the title, no quotes or punctuation:\n\n${context}`,
            },
          ],
        },
      ],
      config: { maxOutputTokens: 20 },
    });

    const title = (response.text ?? "New Conversation")
      .trim()
      .replace(/^["']|["']$/g, "");

    const [updated] = await db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, id))
      .returning();

    res.json({ title: updated?.title ?? title });
  } catch (error) {
    req.log.error({ error }, "Error generating title");
    res.json({ title: conversation.title });
  }
});

export default router;

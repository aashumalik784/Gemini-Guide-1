import { Router } from "express";
import { db, messages, conversations } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListGeminiMessagesParams,
  SendGeminiMessageParams,
  SendGeminiMessageBody,
} from "@workspace/api-zod";

// Groq ke models daal diye
const SUPPORTED_MODELS = [
  "llama-3.3-70b-versatile",
  "mixtral-8x7b-32768",
  "llama3-8b-8192",
];

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

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
    imageData: imageData?? null,
    imageMimeType: imageMimeType?? null,
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
    // Groq ke format mein convert kiya
    const groqMessages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      groqMessages.push({ role: "system", content: systemPrompt });
    }

    for (const m of existingMessages) {
      // Groq image support nahi karta abhi
      if (m.imageData) {
        res.write(`data: ${JSON.stringify({ error: "Image upload abhi Groq mein support nahi hai" })}\n\n`);
        res.end();
        return;
      }
      groqMessages.push({
        role: m.role === "assistant"? "assistant" : "user",
        content: m.content,
      });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment mein set nahi hai");
    }

    // Groq API call with streaming
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json();
      throw new Error(err.error?.message || `Groq API error: ${groqRes.status}`);
    }

    // Stream handle karo - same tere purane code jaisa
    const reader = groqRes.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices[0]?.delta?.content || '';
            if (text) {

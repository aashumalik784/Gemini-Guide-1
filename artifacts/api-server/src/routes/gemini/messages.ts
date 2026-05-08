import { Router } from "express";
import Groq from "groq-sdk";

const router = Router();

// Groq client init
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// POST /api/gemini/conversations/:id/messages
router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { content } = req.body;
    const conversationId = req.params.id;

    if (!content) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Groq ko call kar
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: content,
        },
      ],
      model: "llama-3.1-8b-instant", // Fast model
      temperature: 1,
      max_tokens: 1024,
      stream: false,
    });

    const aiResponse = chatCompletion.choices[0]?.message?.content || "Sorry, kuch galat ho gaya";

    // Response bhej
    res.json({
      id: Date.now().toString(),
      conversationId: conversationId,
      role: "assistant",
      content: aiResponse,
      createdAt: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error("Groq API Error:", error);
    res.status(500).json({ 
      error: "AI se response nahi aa paya",
      details: error.message 
    });
  }
});

export default router;

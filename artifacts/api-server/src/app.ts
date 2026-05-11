import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
app.use(cors()); // Hugging Face Space se call allow karega
app.use(express.json());

const HF_TOKEN = process.env.HF_TOKEN;
const API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1";

app.get('/', (req, res) => {
  res.json({ 
    status: "API is live 🔥", 
    connected_to: "Hugging Face",
    routes: ["/ask-channel"] 
  });
});

app.post('/ask-channel', async (req, res) => {
  const question = req.body.question || "";
  
  if (!question) {
    return res.json({ answer: "Bhai sawaal to pooch 💚" });
  }

  const prompt = `<s> ${question} [/INST]`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        inputs: prompt,
        parameters: { max_new_tokens: 200, temperature: 0.7 }
      })
    });

    const result: any = await response.json();
    
    let reply = "Model so raha hai. 20 sec baad try kar 💚";
    if (Array.isArray(result) && result[0]?.generated_text) {
      reply = result[0].generated_text.replace(prompt, "").trim();
    }
    
    res.json({ answer: reply });
  } catch (error) {
    console.error(error);
    res.json({ answer: "Server error aa gaya bhai 💚" });
  }
});

export default app;

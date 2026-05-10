import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// Groq setup
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// videos.json load karo
let videos: any[] = [];
try {
  const videosPath = path.join(__dirname, '../videos.json');
  const data = fs.readFileSync(videosPath, 'utf8');
  videos = JSON.parse(data);
  console.log(`✅ Loaded ${videos.length} videos from videos.json`);
} catch (e) {
  console.log('⚠️ videos.json nahi mila, khaali array se start kar rahe');
  videos = [];
}

// 1. Home Route
app.get('/', (req, res) => {
  res.json({
    status: "API is live 🔥",
    channel: "Aashu Malik Creations",
    videos_loaded: videos.length,
    routes: ["/health", "/ask-channel", "/youtube-seo"]
  });
});

// 2. Health Check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: "Aashu Bot Zinda Hai 🔥",
    videos: videos.length,
    timestamp: new Date().toISOString()
  });
});

// 3. Subscriber Chat Route
app.post('/ask-channel', async (req, res) => {
  try {
    const { message, lang = 'hi' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message field required hai bhai' });
    }

    const videoList = videos.slice(0, 15).map(v =>
      `Title: ${v.title}\nURL: https://youtu.be/${v.id}\nViews: ${v.views || 'N/A'}`
    ).join('\n\n');

    const systemPrompt = `Tu "Aashu Malik Creations" YouTube channel ka official AI helper bot hai.

Tera naam: Aashu Bot
Tera style: Dosti wala, helpful, "Bhai" bolke baat karne wala

Channel ki latest videos ka data:
${videoList}

Rules:
1. Reply ${lang === 'en'? 'English me' : 'Hindi me'} de
2. Agar user kisi topic pe video mange, to relevant video ka link de
3. Short aur to-the-point reply de, 3-4 line max
4. Emojis use kar sakta hai
5. Agar video nahi hai to bol "Bhai ispe video nahi hai abhi, idea acha hai!"`;

    const chat = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 300,
    });

    const botReply = chat.choices[0]?.message?.content || 'Bhai kuch gadbad ho gayi';
    res.json({ reply: botReply });

  } catch (e: any) {
    console.error('Groq Error:', e);
    res.status(500).json({
      error: 'Bhai server me problem hai',
      details: e.message
    });
  }
});

// 4. YouTube SEO Route
app.post('/youtube-seo', async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'topic field required hai' });
    }

    const prompt = `Tu YouTube SEO ka expert hai. Topic: "${topic}"

Mujhe de:
1. 3 Viral Title - High CTR wale, curiosity create kare
2. Description - 2-3 line me, keywords ke saath
3. 15 Tags - Comma separated, search volume high
4. 5 Hashtags - Trending wale

Format:
**Titles:**
1.
2.
3.

**Description:**

**Tags:**

**Hashtags:**

Reply Hindi me de, proper formatting ke saath.`;

    const chat = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.8,
    });

    res.json({
      seo: chat.choices[0]?.message?.content,
      topic: topic
    });

  } catch (e: any) {
    console.error('SEO Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 5. All videos list
app.get('/videos', (req, res) => {
  res.json({
    total: videos.length,
    videos: videos.slice(0, 20)
  });
});

export default app;

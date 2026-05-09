import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is live!' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Gemini API Server Running' });
});

export default app;

import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.json({ 
    message: 'Backend Live ✅',
    status: '51 ghante baad deploy hua',
    time: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

export default app;

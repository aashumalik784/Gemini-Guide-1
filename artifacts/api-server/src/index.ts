import app from './app';

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app; // Ye line Render ke liye zaroori nahi, hata bhi sakte ho

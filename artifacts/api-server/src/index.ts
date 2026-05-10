import { app } from './src/app';

// Vercel aur Render dono ke liye port handle karna zaroori hai
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;

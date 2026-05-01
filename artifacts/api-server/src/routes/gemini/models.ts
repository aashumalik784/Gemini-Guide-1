import { Router } from "express";

const router = Router();

router.get("/models", (req, res) => {
  res.json([
    {
      id: "gemini-3-flash-preview",
      name: "Gemini 3 Flash",
      description: "Fast and efficient for everyday tasks",
      badge: "Default",
    },
    {
      id: "gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro",
      description: "Most capable for complex reasoning and coding",
      badge: "Most Capable",
    },
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description: "Hybrid reasoning for high-volume tasks",
      badge: null,
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      description: "Excellent at coding and complex analysis",
      badge: null,
    },
  ]);
});

export default router;

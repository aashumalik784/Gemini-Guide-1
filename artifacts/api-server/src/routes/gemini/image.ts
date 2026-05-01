import { Router } from "express";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { GenerateGeminiImageBody } from "@workspace/api-zod";

const router = Router();

router.post("/generate-image", async (req, res) => {
  const parsed = GenerateGeminiImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const { b64_json, mimeType } = await generateImage(parsed.data.prompt);
    res.json({ b64_json, mimeType });
  } catch (error) {
    req.log.error({ error }, "Error generating image");
    res.status(500).json({ error: "Failed to generate image" });
  }
});

export default router;

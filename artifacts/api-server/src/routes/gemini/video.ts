import { Router } from "express";
import { startVideoGeneration, pollVideoOperation } from "@workspace/integrations-gemini-ai/video";

const router = Router();

router.post("/generate-video", async (req, res) => {
  const { prompt, durationSeconds = 5, aspectRatio = "16:9" } = req.body;

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send({ status: "starting", message: "Initializing video generation..." });

    const operationName = await startVideoGeneration(prompt, durationSeconds, aspectRatio);

    if (!operationName) {
      send({ status: "error", message: "Failed to start video generation" });
      res.end();
      return;
    }

    send({ status: "pending", message: "Generating your video... This takes 2–4 minutes.", operationName });

    const MAX_POLLS = 30;
    const POLL_INTERVAL_MS = 10000;
    let polls = 0;

    while (polls < MAX_POLLS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      polls++;

      const status = await pollVideoOperation(operationName);

      if (status.done) {
        if (status.error) {
          send({ status: "error", message: status.error });
        } else {
          send({ status: "done", videoBase64: status.videoBase64, mimeType: status.mimeType });
        }
        res.end();
        return;
      }

      const elapsed = polls * POLL_INTERVAL_MS / 1000;
      send({ status: "pending", message: `Still generating... (${elapsed}s elapsed)` });
    }

    send({ status: "error", message: "Video generation timed out. Please try again." });
  } catch (error: any) {
    req.log.error({ error }, "Error generating video");
    send({ status: "error", message: error?.message || "Video generation failed" });
  }

  res.end();
});

export default router;

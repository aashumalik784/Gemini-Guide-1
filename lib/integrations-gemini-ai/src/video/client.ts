import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY must be set. Please add your Google Gemini API key as a secret.",
  );
}

export const ai = new GoogleGenAI({ apiKey });

export interface VideoGenerationStatus {
  done: boolean;
  videoBase64?: string;
  mimeType?: string;
  error?: string;
}

export async function startVideoGeneration(
  prompt: string,
  durationSeconds: number = 5,
  aspectRatio: string = "16:9"
): Promise<string> {
  const operation = await ai.models.generateVideos({
    model: "veo-2.0-generate-001",
    prompt,
    config: {
      numberOfVideos: 1,
      durationSeconds: durationSeconds as any,
      aspectRatio: aspectRatio as any,
      personGeneration: "allow_adult" as any,
    },
  });
  return operation.name ?? "";
}

export async function pollVideoOperation(
  operationName: string
): Promise<VideoGenerationStatus> {
  const operation = await ai.operations.getVideosOperation({
    operation: { name: operationName } as any,
  });

  if (!operation.done) {
    return { done: false };
  }

  const generatedVideos = (operation as any).response?.generatedVideos;
  if (!generatedVideos?.length) {
    return { done: true, error: "No video generated" };
  }

  const videoUri: string | undefined = generatedVideos[0]?.video?.uri;
  if (!videoUri) {
    return { done: true, error: "No video URI in response" };
  }

  const separator = videoUri.includes("?") ? "&" : "?";
  const fetchUrl = `${videoUri}${separator}key=${apiKey}`;

  const videoResponse = await fetch(fetchUrl);
  if (!videoResponse.ok) {
    return { done: true, error: `Failed to fetch video: ${videoResponse.status}` };
  }

  const videoBuffer = await videoResponse.arrayBuffer();
  const base64 = Buffer.from(videoBuffer).toString("base64");
  const mimeType = videoResponse.headers.get("content-type") || "video/mp4";

  return { done: true, videoBase64: base64, mimeType };
}

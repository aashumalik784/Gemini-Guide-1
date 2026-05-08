import { GoogleGenAI, Modality } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY must be set. Please add your Google Gemini API key as a secret.",
  );
}

const ai = new GoogleGenAI(
  baseUrl
    ? { apiKey, httpOptions: { apiVersion: "", baseUrl } }
    : { apiKey }
);

export { ai };

function extractImageFromResponse(response: any): { b64_json: string; mimeType: string } {
  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData
  );
  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }
  return {
    b64_json: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

export async function generateImage(
  prompt: string
): Promise<{ b64_json: string; mimeType: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-preview-image-generation",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });
  return extractImageFromResponse(response);
}

export async function faceSwap(
  sourceImage: { data: string; mimeType: string },
  targetImage: { data: string; mimeType: string }
): Promise<{ b64_json: string; mimeType: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-preview-image-generation",
    contents: [{
      role: "user",
      parts: [
        {
          text: "Please perform a face swap: take the face from the FIRST image and place it onto the person in the SECOND image. Keep the body, background, clothing, hair, and everything else from the second image exactly as is. Only swap the face. Generate the resulting combined image."
        },
        { inlineData: { data: sourceImage.data, mimeType: sourceImage.mimeType } },
        { inlineData: { data: targetImage.data, mimeType: targetImage.mimeType } },
      ]
    }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });
  return extractImageFromResponse(response);
}

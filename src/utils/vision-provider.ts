import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import {
  getOpenAIClient,
  imageToBase64,
  getImageMediaType,
  extractResponseContent,
} from "./llm.js";

export type VisionProvider = "gemini" | "openai";

export interface VisionImage {
  path: string;
}

export interface VisionRequest {
  prompt: string;
  images: VisionImage[];
}

const GEMINI_VISION_MODEL = "gemini-2.0-flash";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";
const OPENAI_VISION_MODEL = "gpt-4o";
const OPENAI_TEXT_MODEL = "gpt-4o";

export const resolveVisionProvider = (preferred?: string): VisionProvider => {
  if (preferred) {
    if (preferred !== "gemini" && preferred !== "openai") {
      throw new Error(`Unknown provider: ${preferred}. Use 'gemini' or 'openai'.`);
    }
    return preferred;
  }

  if (process.env.GEMINI_API_KEY) {
    return "gemini";
  }
  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  throw new Error(
    "No Vision API key found. Set GEMINI_API_KEY or OPENAI_API_KEY environment variable."
  );
};

const getGeminiClient = (): GoogleGenerativeAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenerativeAI(apiKey);
};

const callGeminiVision = async (request: VisionRequest): Promise<string> => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_VISION_MODEL });

  const imageParts = request.images.map((img) => {
    const base64 = imageToBase64(img.path);
    const mimeType = getImageMediaType(img.path);
    return {
      inlineData: { data: base64, mimeType },
    };
  });

  const result = await model.generateContent([request.prompt, ...imageParts]);
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error("No response from Gemini Vision API");
  }
  return text;
};

const callOpenAIVision = async (request: VisionRequest): Promise<string> => {
  const client = getOpenAIClient();

  const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = request.images.flatMap(
    (img): OpenAI.Chat.ChatCompletionContentPart[] => {
      const base64 = imageToBase64(img.path);
      const mediaType = getImageMediaType(img.path);
      return [
        {
          type: "image_url",
          image_url: { url: `data:${mediaType};base64,${base64}`, detail: "low" },
        },
      ];
    }
  );

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: request.prompt },
    ...imageContents,
  ];

  const response = await client.chat.completions.create({
    model: OPENAI_VISION_MODEL,
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
  });

  return extractResponseContent(response);
};

export const callVisionAPI = async (
  provider: VisionProvider,
  request: VisionRequest
): Promise<string> => {
  switch (provider) {
    case "gemini":
      return callGeminiVision(request);
    case "openai":
      return callOpenAIVision(request);
  }
};

const callGeminiText = async (prompt: string): Promise<string> => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  if (!text) {
    throw new Error("No response from Gemini Text API");
  }
  return text;
};

const callOpenAIText = async (prompt: string): Promise<string> => {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: OPENAI_TEXT_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return extractResponseContent(response);
};

export const callTextLLM = async (provider: VisionProvider, prompt: string): Promise<string> => {
  switch (provider) {
    case "gemini":
      return callGeminiText(prompt);
    case "openai":
      return callOpenAIText(prompt);
  }
};

import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import type { SupportedLang } from "./lang";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

interface SlideContent {
  index: number;
  markdown?: string[];
  imagePath?: string;
  existingText?: string;
  extractedText?: string;
}

interface GenerateTextOptions {
  slides: SlideContent[];
  lang: SupportedLang;
  title?: string;
}

interface GeneratedText {
  index: number;
  text: string;
}

function getLanguageName(lang: SupportedLang): string {
  const langNames: Record<SupportedLang, string> = {
    en: "English",
    ja: "Japanese",
    fr: "French",
    de: "German",
  };
  return langNames[lang];
}

function imageToBase64(imagePath: string): string {
  const absolutePath = path.resolve(imagePath);
  const imageBuffer = fs.readFileSync(absolutePath);
  return imageBuffer.toString("base64");
}

function getImageMediaType(imagePath: string): "image/png" | "image/jpeg" {
  const ext = path.extname(imagePath).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
}

export async function generateTextFromMarkdown(
  options: GenerateTextOptions
): Promise<GeneratedText[]> {
  const { slides, lang, title } = options;
  const languageName = getLanguageName(lang);

  const slideContents = slides
    .map((s, i) => {
      const content = s.markdown?.join("\n") || "(no content)";
      return `--- Slide ${i + 1} ---\n${content}`;
    })
    .join("\n\n");

  const targetIndices = slides.map((s) => s.index);

  const prompt = `You are a professional presenter delivering a live presentation to an audience.

Title: ${title || "Untitled Presentation"}

Here are all the slides in the presentation:

${slideContents}

Generate narration text for slides: ${targetIndices.map((i) => i + 1).join(", ")}

Critical style requirements:
- Write in ${languageName}
- Speak directly to the audience as if presenting live - NEVER use meta-references like "this slide shows", "here we see", "このスライドでは", "ここでは", "この図は"
- Flow naturally from one idea to the next, as a skilled presenter would
- Deliver substantive, insightful explanations - not surface-level descriptions
- Explain concepts and technical terms accurately and clearly
- Connect ideas to help the audience understand the bigger picture
- Use a confident, engaging speaking style suitable for text-to-speech
- Don't just read bullet points - explain what they mean and why they matter

Bad example: "このスライドでは、3つのポイントを説明します。"
Good example: "効果的な実装には3つの重要な要素があります。まず..."

Respond in JSON format:
{
  "slides": [
    {"index": <0-based index>, "text": "<narration text>"},
    ...
  ]
}`;

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const result = JSON.parse(content);
  return result.slides as GeneratedText[];
}

export async function generateTextFromImages(
  options: GenerateTextOptions
): Promise<GeneratedText[]> {
  const { slides, lang, title } = options;
  const languageName = getLanguageName(lang);

  const targetIndices = slides.map((s) => s.index);

  // Check if any slides have extracted text
  const hasExtractedText = slides.some((s) => s.extractedText && s.extractedText.trim().length > 0);

  const extractedTextSection = hasExtractedText
    ? `
Additionally, here is the extracted text from each slide for reference. Use this to understand technical details, proper nouns, and specific information that may not be clearly visible in the images:

${slides
  .map((s, i) => {
    const text = s.extractedText?.trim() || "(no text extracted)";
    return `--- Slide ${i + 1} Text ---\n${text}`;
  })
  .join("\n\n")}
`
    : "";

  const prompt = `You are a professional presenter delivering a live presentation to an audience.

Title: ${title || "Untitled Presentation"}

I'm showing you all slides in the presentation as images.${extractedTextSection}

Generate narration text for slides: ${targetIndices.map((i) => i + 1).join(", ")}

Critical style requirements:
- Write in ${languageName}
- Speak directly to the audience as if presenting live - NEVER use meta-references like "this slide shows", "here we see", "このスライドでは", "ここでは", "この図は"
- Flow naturally from one idea to the next, as a skilled presenter would
- Deliver substantive, insightful explanations - not surface-level descriptions
- Explain concepts, data, and technical terms accurately and clearly
- Connect ideas to help the audience understand the bigger picture
- Use a confident, engaging speaking style suitable for text-to-speech
- When discussing charts, data, or diagrams, explain what the information means and why it matters - don't just describe what's visible
- Use the extracted text to ensure accuracy of technical terms, names, numbers, and specific details

Bad example: "このスライドでは、AIロボティクスの市場動向を示しています。"
Good example: "AIロボティクス市場は急速に拡大しており、2030年には60兆円規模に達すると予測されています。"

Respond in JSON format:
{
  "slides": [
    {"index": <0-based index>, "text": "<narration text>"},
    ...
  ]
}`;

  const slideImageContents = slides
    .filter((slide) => slide.imagePath && fs.existsSync(slide.imagePath))
    .flatMap((slide, i): OpenAI.Chat.ChatCompletionContentPart[] => {
      const base64 = imageToBase64(slide.imagePath!);
      const mediaType = getImageMediaType(slide.imagePath!);
      return [
        { type: "text", text: `--- Slide ${i + 1} ---` },
        {
          type: "image_url",
          image_url: {
            url: `data:${mediaType};base64,${base64}`,
            detail: "high",
          },
        },
      ];
    });

  const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: prompt },
    ...slideImageContents,
  ];

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: imageContents }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const result = JSON.parse(content);
  return result.slides as GeneratedText[];
}

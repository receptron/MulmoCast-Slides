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

  const prompt = `You are creating narration scripts for a presentation.

Title: ${title || "Untitled Presentation"}

Here are all the slides in the presentation:

${slideContents}

Please generate natural, engaging narration text for slides: ${targetIndices.map((i) => i + 1).join(", ")}

Requirements:
- Write in ${languageName}
- Consider the overall flow and context of the presentation
- Make it suitable for text-to-speech narration
- Keep each slide's narration concise but informative
- Don't just read the bullet points; explain and expand on them naturally

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

  const prompt = `You are creating narration scripts for a presentation.

Title: ${title || "Untitled Presentation"}

I'm showing you all slides in the presentation as images.

Please generate natural, engaging narration text for slides: ${targetIndices.map((i) => i + 1).join(", ")}

Requirements:
- Write in ${languageName}
- Consider the overall flow and context of the presentation
- Make it suitable for text-to-speech narration
- Keep each slide's narration concise but informative
- Don't just read the text on slides; explain and expand on them naturally

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
            detail: "low",
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

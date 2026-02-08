import OpenAI from "openai";
import * as fs from "fs";
import { getOpenAIClient, getLanguageName, imageToBase64, getImageMediaType } from "./llm.js";
import type { SupportedLang } from "./lang.js";
import type { ScriptMeta, BeatMeta } from "@mulmocast/extended-types";

export interface BeatInput {
  index: number;
  text?: string;
  markdown?: string[];
  imagePath?: string;
  extractedText?: string;
}

export interface MetadataGenerationOptions {
  beats: BeatInput[];
  lang: SupportedLang;
  title?: string;
  sourceContent?: string;
}

export interface BeatResult {
  index: number;
  text?: string;
  meta: BeatMeta;
}

export interface MetadataResult {
  scriptMeta: ScriptMeta;
  beatResults: BeatResult[];
}

const BATCH_SIZE = 25;

const formatSlideContent = (beat: BeatInput): string => {
  const parts: string[] = [`--- Slide ${beat.index + 1} ---`];
  if (beat.markdown && beat.markdown.length > 0) {
    parts.push(beat.markdown.join("\n"));
  }
  if (beat.extractedText) {
    parts.push(`[Extracted text]: ${beat.extractedText}`);
  }
  if (beat.text) {
    parts.push(`[Existing narration]: ${beat.text}`);
  }
  return parts.join("\n");
};

const buildTextInstruction = (beats: BeatInput[], languageName: string): string => {
  const beatsNeedingText = beats.filter((b) => !b.text || b.text.trim() === "");
  if (beatsNeedingText.length === 0) {
    return "\nAll slides already have narration text. Do NOT generate text for any beat.";
  }

  return `\nGenerate narration "text" for these slides (0-based index): ${beatsNeedingText.map((b) => b.index).join(", ")}
Slides that already have narration should NOT have "text" in their beatResults entry.

Narration style:
- Write in ${languageName}
- Speak directly to the audience as if presenting live
- NEVER use meta-references like "this slide shows", "here we see"
- Deliver substantive, insightful explanations
- Use a confident, engaging speaking style suitable for text-to-speech`;
};

export const buildMetadataPrompt = (options: MetadataGenerationOptions): string => {
  const { beats, lang, title, sourceContent } = options;
  const languageName = getLanguageName(lang);

  const slideContents = beats.map(formatSlideContent).join("\n\n");

  const sourceSection = sourceContent
    ? `\nOriginal source document:\n\`\`\`\n${sourceContent}\n\`\`\`\n`
    : "";

  const textInstruction = buildTextInstruction(beats, languageName);

  return `You are analyzing a presentation to generate metadata and narration.

Title: ${title || "Untitled Presentation"}
${sourceSection}
Here are the slides:

${slideContents}

Generate the following JSON response:

{
  "scriptMeta": {
    "background": "1-2 sentence overview of the theme",
    "audience": "target audience description",
    "goals": ["2-4 learning objectives"],
    "keywords": ["5-10 main keywords"],
    "references": [{"type": "web|code|document|video", "url": "...", "title": "..."}],
    "author": "author if identifiable, or omit",
    "faq": [{"question": "...", "answer": "...", "relatedBeats": ["beat-N"]}]
  },
  "beatResults": [
    {
      "index": <0-based index>,
      "text": "<narration text, only if slide has no existing narration>",
      "meta": {
        "section": "lowercase-kebab-case section name",
        "tags": ["content type tags: intro, overview, definition, example, code, diagram, data, table, demo, comparison, summary, conclusion, q-and-a"],
        "keywords": ["2-5 beat-specific terms"],
        "context": "background info for AI query/summarize - be substantive",
        "expectedQuestions": ["1-3 natural audience questions"]
      }
    }
  ]
}
${textInstruction}

For scriptMeta:
- Write all text in ${languageName}
- "references": only include URLs found in the content. Omit if none.
- "author": omit if not identifiable
- "faq": 2-4 likely questions with substantive answers

For each beat's meta:
- "section": consecutive beats in the same logical section share the same value
- "tags": 2-4 tags per beat
- "context": most important field - add supplementary info, related concepts, technical background
- "expectedQuestions": natural questions a real audience member would ask
- "keywords": prefer specific technical terms

Respond ONLY with valid JSON.`;
};

const buildResultMap = (
  rawResults: Array<{ index: number; text?: string; meta?: BeatMeta }>
): Map<number, { index: number; text?: string; meta?: BeatMeta }> => {
  const map = new Map<number, (typeof rawResults)[number]>();
  rawResults.forEach((r) => map.set(r.index, r));
  return map;
};

const fillBeatResults = (
  resultMap: ReturnType<typeof buildResultMap>,
  beatCount: number
): BeatResult[] => {
  return Array.from({ length: beatCount }, (_, i) => {
    const raw = resultMap.get(i);
    return {
      index: i,
      text: raw?.text,
      meta: raw?.meta ?? {},
    };
  });
};

export const parseMetadataResponse = (content: string, beatCount: number): MetadataResult => {
  const parsed = JSON.parse(content);
  const scriptMeta: ScriptMeta = parsed.scriptMeta ?? {};
  const resultMap = buildResultMap(parsed.beatResults ?? []);
  const beatResults = fillBeatResults(resultMap, beatCount);
  return { scriptMeta, beatResults };
};

const buildImageContents = (beats: BeatInput[]): OpenAI.Chat.ChatCompletionContentPart[] => {
  return beats
    .filter((b) => b.imagePath && fs.existsSync(b.imagePath))
    .flatMap((b): OpenAI.Chat.ChatCompletionContentPart[] => {
      const base64 = imageToBase64(b.imagePath!);
      const mediaType = getImageMediaType(b.imagePath!);
      return [
        { type: "text", text: `--- Slide ${b.index + 1} ---` },
        {
          type: "image_url",
          image_url: { url: `data:${mediaType};base64,${base64}`, detail: "high" },
        },
      ];
    });
};

const extractResponseContent = (response: OpenAI.Chat.ChatCompletion): string => {
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }
  return content;
};

const callLLMForMetadata = async (
  options: MetadataGenerationOptions,
  hasImages: boolean
): Promise<string> => {
  const prompt = buildMetadataPrompt(options);

  const content: OpenAI.Chat.ChatCompletionContentPart[] | string = hasImages
    ? [{ type: "text" as const, text: prompt }, ...buildImageContents(options.beats)]
    : prompt;

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
  });

  return extractResponseContent(response);
};

const deduplicateRefs = (results: MetadataResult[]): MetadataResult["scriptMeta"]["references"] => {
  const allRefs = results.flatMap((r) => r.scriptMeta.references ?? []);
  const unique = allRefs.filter((ref, i, arr) => arr.findIndex((r) => r.url === ref.url) === i);
  return unique.length > 0 ? unique : undefined;
};

const mergeMetadataResults = (results: MetadataResult[]): MetadataResult => {
  if (results.length === 1) {
    return results[0];
  }

  const scriptMeta: ScriptMeta = {
    ...results[0].scriptMeta,
    keywords: [...new Set(results.flatMap((r) => r.scriptMeta.keywords ?? []))],
    faq: results.flatMap((r) => r.scriptMeta.faq ?? []),
    references: deduplicateRefs(results),
  };

  const beatResults = results.flatMap((r) => r.beatResults);

  return { scriptMeta, beatResults };
};

const createBatches = (beats: BeatInput[]): BeatInput[][] => {
  return Array.from({ length: Math.ceil(beats.length / BATCH_SIZE) }, (_, i) =>
    beats.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
  );
};

const remapBeatIndices = (result: MetadataResult, offset: number): MetadataResult => ({
  ...result,
  beatResults: result.beatResults.map((br) => ({ ...br, index: br.index + offset })),
});

const processBatch = async (
  batchBeats: BeatInput[],
  batchIndex: number,
  totalBatches: number,
  globalOffset: number,
  options: MetadataGenerationOptions,
  hasImages: boolean
): Promise<MetadataResult> => {
  console.log(
    `  Batch ${batchIndex + 1}/${totalBatches} (beats ${globalOffset + 1}-${globalOffset + batchBeats.length})...`
  );

  const content = await callLLMForMetadata({ ...options, beats: batchBeats }, hasImages);
  const result = parseMetadataResponse(content, batchBeats.length);
  return remapBeatIndices(result, globalOffset);
};

export const generateNarrationAndMetadata = async (
  options: MetadataGenerationOptions
): Promise<MetadataResult> => {
  const { beats } = options;
  const hasImages = beats.some((b) => b.imagePath);

  if (beats.length <= BATCH_SIZE) {
    const content = await callLLMForMetadata(options, hasImages);
    return parseMetadataResponse(content, beats.length);
  }

  console.log(`Processing ${beats.length} beats in batches of ${BATCH_SIZE}...`);
  const batches = createBatches(beats);

  const results: MetadataResult[] = [];
  for (const [i, batchBeats] of batches.entries()) {
    const result = await processBatch(
      batchBeats,
      i,
      batches.length,
      i * BATCH_SIZE,
      options,
      hasImages
    );
    results.push(result);
  }

  return mergeMetadataResults(results);
};

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

export const buildMetadataPrompt = (options: MetadataGenerationOptions): string => {
  const { beats, lang, title, sourceContent } = options;
  const languageName = getLanguageName(lang);

  const slideContents = beats
    .map((b) => {
      const parts: string[] = [`--- Slide ${b.index + 1} ---`];
      if (b.markdown && b.markdown.length > 0) {
        parts.push(b.markdown.join("\n"));
      }
      if (b.extractedText) {
        parts.push(`[Extracted text]: ${b.extractedText}`);
      }
      if (b.text) {
        parts.push(`[Existing narration]: ${b.text}`);
      }
      return parts.join("\n");
    })
    .join("\n\n");

  const sourceSection = sourceContent
    ? `\nOriginal source document:\n\`\`\`\n${sourceContent}\n\`\`\`\n`
    : "";

  const beatsNeedingText = beats.filter((b) => !b.text || b.text.trim() === "");
  const textInstruction =
    beatsNeedingText.length > 0
      ? `\nGenerate narration "text" for these slides (0-based index): ${beatsNeedingText.map((b) => b.index).join(", ")}
Slides that already have narration should NOT have "text" in their beatResults entry.

Narration style:
- Write in ${languageName}
- Speak directly to the audience as if presenting live
- NEVER use meta-references like "this slide shows", "here we see"
- Deliver substantive, insightful explanations
- Use a confident, engaging speaking style suitable for text-to-speech`
      : "\nAll slides already have narration text. Do NOT generate text for any beat.";

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

export const parseMetadataResponse = (content: string, beatCount: number): MetadataResult => {
  const parsed = JSON.parse(content);

  const scriptMeta: ScriptMeta = parsed.scriptMeta ?? {};
  const rawBeatResults: Array<{
    index: number;
    text?: string;
    meta?: BeatMeta;
  }> = parsed.beatResults ?? [];

  // Build a map of results by index
  const resultMap = new Map<number, (typeof rawBeatResults)[number]>();
  rawBeatResults.forEach((r) => resultMap.set(r.index, r));

  // Ensure we have a result for every beat
  const beatResults: BeatResult[] = [];
  for (let i = 0; i < beatCount; i++) {
    const raw = resultMap.get(i);
    beatResults.push({
      index: i,
      text: raw?.text,
      meta: raw?.meta ?? {},
    });
  }

  return { scriptMeta, beatResults };
};

const callLLMForMetadata = async (
  options: MetadataGenerationOptions,
  hasImages: boolean
): Promise<string> => {
  const prompt = buildMetadataPrompt(options);

  if (hasImages) {
    const imageContents = options.beats
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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [{ type: "text", text: prompt }, ...imageContents],
      },
    ];

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }
    return content;
  }

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }
  return content;
};

const mergeMetadataResults = (results: MetadataResult[]): MetadataResult => {
  if (results.length === 1) {
    return results[0];
  }

  // Use the first batch's scriptMeta (most comprehensive since it has initial context)
  const scriptMeta = results[0].scriptMeta;

  // Merge keywords from all batches
  const allKeywords = results.flatMap((r) => r.scriptMeta.keywords ?? []);
  scriptMeta.keywords = [...new Set(allKeywords)];

  // Merge FAQ from all batches
  const allFaq = results.flatMap((r) => r.scriptMeta.faq ?? []);
  scriptMeta.faq = allFaq;

  // Merge references from all batches
  const allRefs = results.flatMap((r) => r.scriptMeta.references ?? []);
  const uniqueRefs = allRefs.filter((ref, i, arr) => arr.findIndex((r) => r.url === ref.url) === i);
  scriptMeta.references = uniqueRefs.length > 0 ? uniqueRefs : undefined;

  // Concatenate all beat results
  const beatResults = results.flatMap((r) => r.beatResults);

  return { scriptMeta, beatResults };
};

export const generateNarrationAndMetadata = async (
  options: MetadataGenerationOptions
): Promise<MetadataResult> => {
  const { beats } = options;
  const hasImages = beats.some((b) => b.imagePath);

  // Split into batches if needed
  if (beats.length <= BATCH_SIZE) {
    const content = await callLLMForMetadata(options, hasImages);
    return parseMetadataResponse(content, beats.length);
  }

  console.log(`Processing ${beats.length} beats in batches of ${BATCH_SIZE}...`);
  const results: MetadataResult[] = [];

  for (let i = 0; i < beats.length; i += BATCH_SIZE) {
    const batchBeats = beats.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(beats.length / BATCH_SIZE);
    console.log(`  Batch ${batchNum}/${totalBatches} (beats ${i + 1}-${i + batchBeats.length})...`);

    const batchOptions: MetadataGenerationOptions = {
      ...options,
      beats: batchBeats,
    };

    const content = await callLLMForMetadata(batchOptions, hasImages);
    const result = parseMetadataResponse(content, batchBeats.length);

    // Remap indices back to global
    result.beatResults.forEach((br) => {
      br.index = br.index + i;
    });

    results.push(result);
  }

  return mergeMetadataResults(results);
};

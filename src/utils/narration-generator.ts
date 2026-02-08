import type { SupportedLang } from "./lang.js";
import { getLanguageName } from "./llm.js";
import type { DocumentAnalysis } from "./document-analysis.js";

export interface NarrationInput {
  documentAnalysis: DocumentAnalysis;
  extractedTexts: string[];
  lang: SupportedLang;
}

export interface NarrationEntry {
  index: number;
  text: string;
}

export const buildNarrationPrompt = (input: NarrationInput): string => {
  const { documentAnalysis, extractedTexts, lang } = input;
  const languageName = getLanguageName(lang);

  const slideSpecs = documentAnalysis.slides
    .map((slide, i) => {
      const sourceTexts = slide.sourcePages
        .map((p) => extractedTexts[p])
        .filter(Boolean)
        .join("\n---\n");
      const truncatedText =
        sourceTexts.length > 3000 ? sourceTexts.slice(0, 3000) + "..." : sourceTexts;

      const parts: string[] = [
        `--- Slide ${i} ---`,
        `Title: ${slide.title}`,
        `Section: ${slide.section}`,
        `Narration hint: ${slide.narrationHint}`,
      ];
      if (slide.figureRef) {
        parts.push(`Key visual: ${slide.figureRef}`);
      }
      if (truncatedText) {
        parts.push(`Source text:\n${truncatedText}`);
      }
      return parts.join("\n");
    })
    .join("\n\n");

  return `You are a professional presenter creating narration for a presentation.

Document: "${documentAnalysis.title}"${documentAnalysis.authors ? ` by ${documentAnalysis.authors}` : ""}

Here are the slides with their source content and narration hints:

${slideSpecs}

Generate narration text for ALL ${documentAnalysis.slides.length} slides.

Requirements:
- Write in ${languageName}
- Speak directly to the audience as if presenting live
- NEVER use meta-references like "this slide shows", "here we see", "このスライドでは"
- When a slide has a key visual (figure/table/chart), explain what it shows and why it matters
- Flow naturally between slides as a coherent presentation
- Be substantive - explain concepts, don't just list bullet points
- Use a confident, engaging speaking style suitable for text-to-speech
- Each narration should be 2-5 sentences

Respond in JSON:
{
  "narrations": [
    {"index": 0, "text": "narration text"},
    {"index": 1, "text": "narration text"}
  ]
}

Respond ONLY with valid JSON.`;
};

const extractJsonFromResponse = (content: string): string => {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  return content.trim();
};

export const parseNarrationResponse = (content: string, slideCount: number): NarrationEntry[] => {
  const jsonStr = extractJsonFromResponse(content);
  const parsed = JSON.parse(jsonStr);
  const narrations: NarrationEntry[] = (parsed.narrations ?? []).map(
    (n: Record<string, unknown>) => ({
      index: Number(n.index ?? 0),
      text: String(n.text ?? ""),
    })
  );

  // Fill missing indices with empty text
  const resultMap = new Map(narrations.map((n) => [n.index, n]));
  return Array.from({ length: slideCount }, (_, i) => resultMap.get(i) ?? { index: i, text: "" });
};

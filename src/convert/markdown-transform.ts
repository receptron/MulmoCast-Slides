/**
 * Markdown to MulmoScript Pure Transform
 *
 * Browser-safe pure functions for converting markdown strings to MulmoScript JSON.
 * No Node.js dependencies (no fs, path, process, franc).
 */

import type { MulmoBeat } from "mulmocast";
import type { SupportedLang } from "../utils/lang-common";
import type { SeparatorMode } from "./markdown-plugins/types";
import { splitIntoSlides, processMarkdown } from "./markdown-plugins/index";
import { extractNotesFromSlide, extractMarkdownFromSlide } from "./markdown-utils-common";

export interface MarkdownToMulmoScriptOptions {
  lang?: SupportedLang;
  separator?: SeparatorMode;
  mermaid?: boolean;
  directive?: boolean;
  layout?: boolean;
  style?: string;
}

export interface MulmoScriptData {
  $mulmocast: { version: string; credit: string };
  lang: SupportedLang;
  beats: Partial<MulmoBeat>[];
}

// ============================================================================
// Beat Generation
// ============================================================================

export function slideToBeat(
  markdown: string,
  note: string,
  beat: Partial<MulmoBeat> | null,
  style?: string
): Partial<MulmoBeat> {
  if (beat?.image) {
    return { text: ("text" in beat ? beat.text : undefined) || note, image: beat.image };
  }

  const markdownLines = extractMarkdownFromSlide(markdown);
  return {
    text: note,
    image: style
      ? { type: "markdown" as const, markdown: markdownLines, style }
      : { type: "markdown" as const, markdown: markdownLines },
  };
}

export function slidesToMulmoScript(
  slides: { markdown: string; note: string; beat: Partial<MulmoBeat> | null }[],
  lang: SupportedLang,
  style?: string
): MulmoScriptData {
  return {
    $mulmocast: { version: "1.1", credit: "closing" },
    lang,
    beats: slides.map((slide) => slideToBeat(slide.markdown, slide.note, slide.beat, style)),
  };
}

// ============================================================================
// Main Pure Transform
// ============================================================================

/**
 * Convert markdown string to MulmoScript JSON (pure function, browser-safe).
 *
 * Unlike `convertMarkdown()`, this function:
 * - Takes a markdown string (not a file path)
 * - Does not perform file I/O
 * - Does not call LLM for narration generation
 * - Does not auto-detect language (requires explicit `lang` option, defaults to "en")
 */
export function markdownToMulmoScript(
  content: string,
  options?: MarkdownToMulmoScriptOptions
): MulmoScriptData {
  const separator = options?.separator ?? "horizontal-rule";
  const lang: SupportedLang = options?.lang ?? "en";

  const rawSlides = splitIntoSlides(content, separator);

  const slides = processMarkdown(rawSlides, {
    mermaid: options?.mermaid,
    directive: options?.directive,
    layout: options?.layout,
  }).map(({ markdown, beat }) => ({
    markdown,
    beat,
    note: extractNotesFromSlide(markdown),
  }));

  return slidesToMulmoScript(slides, lang, options?.style);
}

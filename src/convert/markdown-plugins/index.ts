/**
 * Markdown Plugin System
 *
 * Split markdown by separator and convert to MulmoScript.
 * HTML rendering is done by mulmocast, not here.
 */

import type { MulmoBeat } from "mulmocast";
import type {
  MarkdownPlugin,
  PluginContext,
  SeparatorMode,
  MarkdownConvertOptions,
} from "./types.js";

// Re-export types
export type { SeparatorMode, MarkdownConvertOptions } from "./types.js";

/** Result of processing a single slide */
export type ProcessedSlide = {
  markdown: string;
  beat: Partial<MulmoBeat> | null;
};

// Built-in plugins
import { mermaidPlugin } from "./mermaid.js";
import { directivePlugin } from "./directive.js";
import { layoutPlugin } from "./layout.js";

/**
 * Get separator regex pattern
 */
export function getSeparatorPattern(mode: SeparatorMode): RegExp {
  if (typeof mode === "object" && "pattern" in mode) {
    return new RegExp(mode.pattern, "gm");
  }

  switch (mode) {
    case "horizontal-rule":
      return /\n---\n/;
    case "heading":
      return /\n(?=#{1,6}\s)/;
    case "heading-1":
      return /\n(?=#\s)/;
    case "heading-2":
      return /\n(?=##\s)/;
    case "heading-3":
      return /\n(?=###\s)/;
    case "blank-lines":
      return /\n{3,}/;
    case "comment":
      return /\n?<!--\s*slide\s*-->\n?/i;
    case "page-break":
      return /\n?(?:<!--\s*pagebreak\s*-->|\f)\n?/i;
    default:
      return /\n---\n/;
  }
}

/**
 * Remove YAML front matter from first slide if present
 */
export const removeYamlFrontMatter = (slides: string[]): string[] =>
  slides.length > 0 && slides[0].trim().startsWith("---") ? slides.slice(1) : slides;

/**
 * Filter out empty slides
 */
export const filterEmptySlides = (slides: string[]): string[] =>
  slides.filter((s) => s.trim().length > 0);

/**
 * Check if separator is heading-based
 */
export const isHeadingSeparator = (sep: SeparatorMode): boolean =>
  sep === "heading" || sep === "heading-1" || sep === "heading-2" || sep === "heading-3";

/**
 * Split markdown into slides using specified separator
 */
export function splitIntoSlides(
  content: string,
  separator: SeparatorMode = "horizontal-rule"
): string[] {
  const pattern = getSeparatorPattern(separator);

  const normalized = content.replace(/\r\n/g, "\n");
  const rawSlides = normalized.split(pattern);

  if (separator === "horizontal-rule") {
    return filterEmptySlides(removeYamlFrontMatter(rawSlides));
  }

  if (isHeadingSeparator(separator)) {
    return filterEmptySlides(rawSlides);
  }

  return filterEmptySlides(rawSlides);
}

/**
 * Build sorted plugin list from options
 */
export const buildPluginList = (options: MarkdownConvertOptions): MarkdownPlugin[] =>
  [
    options.directive && directivePlugin,
    options.mermaid && mermaidPlugin,
    options.layout && layoutPlugin,
  ]
    .filter((p): p is MarkdownPlugin => Boolean(p))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

/**
 * Apply all preprocessors to markdown
 */
export const applyPreprocessors = (
  markdown: string,
  plugins: MarkdownPlugin[],
  context: PluginContext
): string =>
  plugins.reduce(
    (md, plugin) => (plugin.preprocess ? plugin.preprocess(md, context) : md),
    markdown
  );

/**
 * Find first plugin that generates a beat
 */
export const findBeat = (
  markdown: string,
  plugins: MarkdownPlugin[],
  context: PluginContext
): Partial<MulmoBeat> | null => {
  for (const plugin of plugins) {
    if (plugin.toBeat) {
      const result = plugin.toBeat(markdown, context);
      if (result) return result;
    }
  }
  return null;
};

/**
 * Process markdown through plugins (preprocess only, no HTML rendering)
 */
export function processMarkdown(
  slides: string[],
  options: MarkdownConvertOptions = {}
): ProcessedSlide[] {
  const plugins = buildPluginList(options);

  return slides.map((slide, index) => {
    const context: PluginContext = { slideIndex: index, totalSlides: slides.length };
    const markdown = applyPreprocessors(slide, plugins, context);
    const beat = findBeat(markdown, plugins, context);
    return { markdown, beat };
  });
}

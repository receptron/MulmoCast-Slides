/**
 * Markdown Plugin System
 *
 * Split markdown by separator and convert to MulmoScript.
 * HTML rendering is done by mulmocast, not here.
 */

import type { MarkdownPlugin, PluginContext, SeparatorMode, MarkdownConvertOptions } from "./types";

// Re-export types
export type { SeparatorMode, MarkdownConvertOptions } from "./types";

// Built-in plugins
import { mermaidPlugin } from "./mermaid";
import { directivePlugin } from "./directive";

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
 * Split markdown into slides using specified separator
 */
export function splitIntoSlides(
  content: string,
  separator: SeparatorMode = "horizontal-rule"
): string[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const pattern = getSeparatorPattern(separator);

  let slides: string[];

  if (separator === "horizontal-rule") {
    // Special handling for --- to detect YAML front matter
    slides = normalized.split(pattern);

    // Check if first section is YAML front matter
    if (slides.length > 0 && slides[0].trim().startsWith("---")) {
      slides.shift();
    }
  } else if (
    separator === "heading" ||
    separator === "heading-1" ||
    separator === "heading-2" ||
    separator === "heading-3"
  ) {
    // For heading-based splitting, keep the heading with its content
    slides = normalized.split(pattern).filter((s) => s.trim());
  } else {
    slides = normalized.split(pattern);
  }

  return slides.filter((slide) => slide.trim().length > 0);
}

/**
 * Process markdown through plugins (preprocess only, no HTML rendering)
 */
export function processMarkdown(
  slides: string[],
  options: MarkdownConvertOptions = {}
): { markdown: string; beat: Partial<import("mulmocast").MulmoBeat> | null }[] {
  // Build plugin list from boolean flags (directive runs first due to higher priority)
  const plugins: MarkdownPlugin[] = [];
  if (options.directive) plugins.push(directivePlugin);
  if (options.mermaid) plugins.push(mermaidPlugin);

  // Sort by priority (higher first)
  plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return slides.map((slide, i) => {
    let markdown = slide;
    const context: PluginContext = { slideIndex: i, totalSlides: slides.length };

    // Run preprocessors
    for (const plugin of plugins) {
      if (plugin.preprocess) {
        markdown = plugin.preprocess(markdown, context);
      }
    }

    // Try to generate custom beat
    let beat: Partial<import("mulmocast").MulmoBeat> | null = null;
    for (const plugin of plugins) {
      if (plugin.toBeat) {
        const result = plugin.toBeat(markdown, context);
        if (result) {
          beat = result;
          break;
        }
      }
    }

    return { markdown, beat };
  });
}

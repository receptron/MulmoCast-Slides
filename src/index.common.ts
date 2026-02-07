/**
 * Common exports (browser-safe)
 *
 * This module contains only pure functions with no Node.js dependencies.
 * Safe to use in browser environments (Vue, React, Vite, etc.).
 */

// Main transform function
export {
  markdownToMulmoScript,
  slideToBeat,
  slidesToMulmoScript,
} from "./convert/markdown-transform";
export type { MarkdownToMulmoScriptOptions, MulmoScriptData } from "./convert/markdown-transform";

// Plugin system
export { splitIntoSlides, processMarkdown } from "./convert/markdown-plugins/index";
export type { SeparatorMode, MarkdownConvertOptions } from "./convert/markdown-plugins/types";

// Plugins
export { directivePlugin } from "./convert/markdown-plugins/directive";
export { mermaidPlugin } from "./convert/markdown-plugins/mermaid";
export { layoutPlugin } from "./convert/markdown-plugins/layout";

// Utilities (browser-safe subset)
export { extractNotesFromSlide, extractMarkdownFromSlide } from "./convert/markdown-utils-common";

// Language types and validation (browser-safe)
export type { SupportedLang } from "./utils/lang-common";
export { SUPPORTED_LANGS, DEFAULT_LANG, isValidLang } from "./utils/lang-common";

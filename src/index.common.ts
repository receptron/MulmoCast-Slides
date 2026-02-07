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
} from "./convert/markdown-transform.js";
export type {
  MarkdownToMulmoScriptOptions,
  MulmoScriptData,
} from "./convert/markdown-transform.js";

// Plugin system
export { splitIntoSlides, processMarkdown } from "./convert/markdown-plugins/index.js";
export type { SeparatorMode, MarkdownConvertOptions } from "./convert/markdown-plugins/types.js";

// Plugins
export { directivePlugin } from "./convert/markdown-plugins/directive.js";
export { mermaidPlugin } from "./convert/markdown-plugins/mermaid.js";
export { layoutPlugin } from "./convert/markdown-plugins/layout.js";

// Utilities (browser-safe subset)
export {
  extractNotesFromSlide,
  extractMarkdownFromSlide,
} from "./convert/markdown-utils-common.js";

// Language types and validation (browser-safe)
export type { SupportedLang } from "./utils/lang-common.js";
export { SUPPORTED_LANGS, DEFAULT_LANG, isValidLang } from "./utils/lang-common.js";

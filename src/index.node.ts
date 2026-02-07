/**
 * Node.js entry point
 *
 * Re-exports all browser-safe utilities plus Node-specific functions
 * that depend on file I/O, process.env, franc, LLM, etc.
 */

// Browser-safe exports
export * from "./index.common.js";

// Node-specific: file-based markdown converter
export { convertMarkdown } from "./convert/markdown.js";
export type { ConvertMarkdownOptions, ConvertMarkdownResult } from "./convert/markdown-utils.js";

// Node-specific: language detection (franc, process.env)
export { resolveLang, detectLang, getLangFromEnv, langOption } from "./utils/lang.js";

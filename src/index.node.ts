/**
 * Node.js entry point
 *
 * Re-exports all browser-safe utilities plus Node-specific functions
 * that depend on file I/O, process.env, franc, LLM, etc.
 */

// Browser-safe exports
export * from "./index.common";

// Node-specific: file-based markdown converter
export { convertMarkdown } from "./convert/markdown";
export type { ConvertMarkdownOptions, ConvertMarkdownResult } from "./convert/markdown-utils";

// Node-specific: language detection (franc, process.env)
export { resolveLang, detectLang, getLangFromEnv, langOption } from "./utils/lang";

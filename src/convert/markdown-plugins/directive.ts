/**
 * Directive Plugin
 *
 * Handles Marp-style directives and removes them from output.
 * Extracts metadata like class, background, etc.
 *
 * Supported directives:
 * - <!-- _class: lead -->
 * - <!-- _backgroundColor: #fff -->
 * - <!-- _backgroundImage: url(...) -->
 * - <!-- _header: ... -->
 * - <!-- _footer: ... -->
 */

import type { MarkdownPlugin, PluginContext } from "./types";

// Directive pattern: <!-- _key: value -->
const DIRECTIVE_REGEX = /<!--\s*_(\w+):\s*(.+?)\s*-->/g;

export const directivePlugin: MarkdownPlugin = {
  name: "directive",
  priority: 100, // Run early to extract metadata

  preprocess(markdown: string, context: PluginContext): string {
    // Extract and store directives in metadata
    const directives: Record<string, string> = {};

    // Extract inline directives
    let cleaned = markdown.replace(DIRECTIVE_REGEX, (_match, key, value) => {
      directives[key] = value.trim();
      return ""; // Remove directive from content
    });

    // Store in context metadata
    context.metadata.directives = directives;

    // Clean up extra whitespace from removed directives
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

    return cleaned;
  },
};

export default directivePlugin;

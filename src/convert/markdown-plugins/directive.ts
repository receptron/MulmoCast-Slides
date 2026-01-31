/**
 * Directive Plugin
 *
 * Removes Marp-style directives from markdown output.
 *
 * Supported directives:
 * - <!-- _class: lead -->
 * - <!-- _backgroundColor: #fff -->
 * - <!-- _backgroundImage: url(...) -->
 * - <!-- _header: ... -->
 * - <!-- _footer: ... -->
 * - <!-- _paginate: ... -->
 */

import type { MarkdownPlugin } from "./types";

// Directive pattern: <!-- _key: value -->
const DIRECTIVE_REGEX = /<!--\s*_(\w+):\s*(.+?)\s*-->/g;

export const directivePlugin: MarkdownPlugin = {
  name: "directive",
  priority: 100, // Run early

  preprocess(markdown: string): string {
    // Remove directives
    let cleaned = markdown.replace(DIRECTIVE_REGEX, "");

    // Clean up extra whitespace from removed directives
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

    return cleaned;
  },
};

export default directivePlugin;

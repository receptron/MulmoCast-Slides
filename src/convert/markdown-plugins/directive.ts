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

import type { MarkdownPlugin } from "./types.js";

// Directive pattern: <!-- _key: value -->
const DIRECTIVE_REGEX = /<!--\s*_(\w+):\s*(.+?)\s*-->/g;

export const directivePlugin: MarkdownPlugin = {
  name: "directive",
  priority: 100, // Run early

  preprocess(markdown: string): string {
    return markdown
      .replace(DIRECTIVE_REGEX, "") // Remove directives
      .replace(/\n{3,}/g, "\n\n") // Clean up extra whitespace
      .trim();
  },
};

/**
 * Mermaid Plugin
 *
 * Converts ```mermaid code blocks to MulmoBeat mermaid type.
 */

import type { MarkdownPlugin } from "./types";
import type { MulmoBeat } from "mulmocast";

const MERMAID_REGEX = /```mermaid\n([\s\S]*?)```/;

export const mermaidPlugin: MarkdownPlugin = {
  name: "mermaid",
  priority: 10,

  toBeat(markdown: string): Partial<MulmoBeat> | null {
    const match = markdown.match(MERMAID_REGEX);
    if (!match) {
      return null;
    }

    const mermaidCode = match[1].trim();

    // Extract title from first heading if present
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract text from non-mermaid content
    const textContent = markdown.replace(MERMAID_REGEX, "").replace(/^#.*$/gm, "").trim();

    return {
      text: textContent || title || "",
      image: {
        type: "mermaid",
        title: title || "Diagram",
        code: {
          kind: "text",
          text: mermaidCode,
        },
      },
    };
  },
};

export default mermaidPlugin;

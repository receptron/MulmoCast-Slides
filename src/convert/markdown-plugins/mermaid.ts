/**
 * Mermaid Plugin
 *
 * Converts ```mermaid code blocks to markdown with row-2 layout.
 * This allows mermaid diagrams to be displayed alongside explanatory text.
 */

import type { MarkdownPlugin } from "./types";
import type { MulmoBeat } from "mulmocast";

const MERMAID_REGEX = /```mermaid\n([\s\S]*?)```/g;
const MERMAID_SINGLE_REGEX = /```mermaid\n([\s\S]*?)```/;

/**
 * Extract mermaid code blocks from markdown
 */
const extractMermaidBlocks = (markdown: string): string[] => {
  const matches = [...markdown.matchAll(MERMAID_REGEX)];
  return matches.map((match) => match[1].trim());
};

/**
 * Extract non-mermaid content from markdown
 */
const extractNonMermaidContent = (markdown: string): string[] => {
  const content = markdown
    .replace(MERMAID_REGEX, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => {
      // Remove leading empty lines
      if (index === 0 && line === "") return false;
      // Remove trailing empty lines
      if (index === arr.length - 1 && line === "") return false;
      return true;
    });

  // Remove consecutive empty lines (keep only one)
  return content.reduce<string[]>((acc, line) => {
    if (line === "" && acc.length > 0 && acc[acc.length - 1] === "") {
      return acc;
    }
    return [...acc, line];
  }, []);
};

/**
 * Build mermaid code block as array of strings for markdown layout
 */
const buildMermaidLines = (mermaidCode: string): string[] => [
  "```mermaid",
  ...mermaidCode.split("\n"),
  "```",
];

export const mermaidPlugin: MarkdownPlugin = {
  name: "mermaid",
  priority: 10,

  toBeat(markdown: string): Partial<MulmoBeat> | null {
    const match = markdown.match(MERMAID_SINGLE_REGEX);
    if (!match) {
      return null;
    }

    const mermaidBlocks = extractMermaidBlocks(markdown);
    const nonMermaidContent = extractNonMermaidContent(markdown);

    // Single mermaid block with explanatory content -> row-2 layout
    if (mermaidBlocks.length === 1 && nonMermaidContent.length > 0) {
      const mermaidLines = buildMermaidLines(mermaidBlocks[0]);

      return {
        image: {
          type: "markdown",
          markdown: {
            "row-2": [nonMermaidContent, mermaidLines],
          },
        },
      } as Partial<MulmoBeat>;
    }

    // Multiple mermaid blocks -> 2x2 layout (alternating content and diagrams)
    if (mermaidBlocks.length >= 2) {
      const cells = mermaidBlocks.flatMap((code, index) => {
        const label = [`### Diagram ${index + 1}`];
        const mermaidLines = buildMermaidLines(code);
        return [label, mermaidLines];
      });

      // If there's header content, use it
      const headerContent = nonMermaidContent.length > 0 ? nonMermaidContent : undefined;

      return {
        image: {
          type: "markdown",
          markdown: headerContent
            ? { header: headerContent.join("\n"), "2x2": cells.slice(0, 4) }
            : { "2x2": cells.slice(0, 4) },
        },
      } as Partial<MulmoBeat>;
    }

    // Only mermaid (no explanatory content) -> simple markdown with mermaid code block
    const mermaidLines = buildMermaidLines(mermaidBlocks[0]);
    return {
      image: {
        type: "markdown",
        markdown: mermaidLines,
      },
    } as Partial<MulmoBeat>;
  },
};

export default mermaidPlugin;

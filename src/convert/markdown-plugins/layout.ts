/**
 * Layout Plugin
 *
 * Auto-detects layout based on markdown content and converts to mulmocast layout format.
 *
 * ## Detection Rules (evaluated in order, first match wins)
 *
 * ┌─────────────────────────────────────┬────────────┬─────────────────────────────────────┐
 * │ Content Pattern                     │ Layout     │ Conditions                          │
 * ├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ 1. Single code block + text         │ row-2      │ - Exactly 1 code block (```)        │
 * │                                     │            │ - Text content > 20 chars           │
 * │                                     │            │ - Result: [text, code]              │
 * ├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ 2. Single image + text              │ row-2      │ - Exactly 1 image (![]())           │
 * │                                     │            │ - Text content > 20 chars           │
 * │                                     │            │ - Result: [text, image]             │
 * ├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ 3. 4+ H3 sections (short)           │ 2x2        │ - 4 or more ### headings            │
 * │                                     │            │ - Avg content < 200 chars           │
 * │                                     │            │ - Result: first 4 sections          │
 * ├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ 4. 4+ H2 sections (short)           │ 2x2        │ - 4 or more ## headings             │
 * │                                     │            │ - Avg content < 200 chars           │
 * │                                     │            │ - Result: first 4 sections          │
 * ├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ 5. 4+ H2 sections (long)            │ row-2      │ - 4 or more ## headings             │
 * │                                     │            │ - Avg content >= 200 chars          │
 * │                                     │            │ - Result: first 2 sections          │
 * ├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ 6. 2+ H2 sections                   │ row-2      │ - 2 or more ## headings             │
 * │                                     │            │ - Result: first 2 sections          │
 * ├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ 7. Otherwise                        │ null       │ - No layout applied                 │
 * │                                     │            │ - Falls back to default markdown    │
 * └─────────────────────────────────────┴────────────┴─────────────────────────────────────┘
 *
 * ## "Meaningful text" definition
 * - Text without headings (# ## ###) must be > 20 characters
 * - Used to distinguish "code only" slides from "explanation + code" slides
 *
 * ## Priority
 * - This plugin has priority 5 (lower than mermaid at 10)
 * - Mermaid plugin takes precedence for ```mermaid blocks
 */

import type { MarkdownPlugin } from "./types";
import type { MulmoBeat } from "mulmocast";

// ============================================================================
// Types
// ============================================================================

type LayoutMarkdown = Record<string, string | string[] | string[][]>;

interface Section {
  heading: string;
  content: string;
}

/** Layout detection rule: returns layout markdown if matches, null otherwise */
type LayoutRule = (markdown: string) => LayoutMarkdown | null;

// ============================================================================
// Regex Patterns
// ============================================================================

const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;
const IMAGE_REGEX = /!\[.*?\]\(.*?\)/g;

// ============================================================================
// Helper Functions
// ============================================================================

const extractCodeBlocks = (markdown: string): string[] =>
  (markdown.match(CODE_BLOCK_REGEX) || []).map((block) => block.trim());

const extractImages = (markdown: string): string[] => markdown.match(IMAGE_REGEX) || [];

const extractTextContent = (markdown: string): string =>
  markdown
    .replace(CODE_BLOCK_REGEX, "")
    .replace(IMAGE_REGEX, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

const hasMeaningfulText = (text: string): boolean =>
  text.replace(/^#{1,6}\s+.+$/gm, "").trim().length > 20;

const splitByHeading = (markdown: string, pattern: RegExp): Section[] => {
  const sections: Section[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];

  markdown.split("\n").forEach((line) => {
    if (pattern.test(line)) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
      }
      currentHeading = line;
      currentContent = [];
    } else if (currentHeading) {
      currentContent.push(line);
    }
  });

  if (currentHeading) {
    sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
  }

  return sections;
};

const splitByH2 = (markdown: string): Section[] => splitByHeading(markdown, /^##\s+/);
const splitByH3 = (markdown: string): Section[] => splitByHeading(markdown, /^###\s+/);

const avgContentLength = (sections: Section[]): number =>
  sections.reduce((sum, s) => sum + s.content.length, 0) / sections.length;

const toLines = (text: string): string[] => text.split("\n").map((line) => line.trimEnd());

const sectionToLines = (section: Section): string[] =>
  toLines([section.heading, "", section.content].join("\n"));

// ============================================================================
// Layout Rules (evaluated in order, first match wins)
// ============================================================================

/** Rule 1: Single code block + meaningful text → row-2 */
export const tryCodeBlockLayout: LayoutRule = (markdown) => {
  const codeBlocks = extractCodeBlocks(markdown);
  if (codeBlocks.length !== 1) return null;

  const textContent = extractTextContent(markdown);
  if (!hasMeaningfulText(textContent)) return null;

  const textLines = toLines(markdown.replace(codeBlocks[0], "").replace(/<!--[\s\S]*?-->/g, ""));
  const codeLines = toLines(codeBlocks[0]);

  return { "row-2": [textLines, codeLines] };
};

/** Rule 2: Single image + meaningful text → row-2 */
export const tryImageLayout: LayoutRule = (markdown) => {
  const images = extractImages(markdown);
  if (images.length !== 1) return null;

  const textContent = extractTextContent(markdown);
  if (!hasMeaningfulText(textContent)) return null;

  const textLines = toLines(markdown.replace(images[0], "").replace(/<!--[\s\S]*?-->/g, ""));

  return { "row-2": [textLines, [images[0]]] };
};

/** Rule 3: 4+ H3 sections with short content → 2x2 */
export const tryH3GridLayout: LayoutRule = (markdown) => {
  const sections = splitByH3(markdown);
  if (sections.length < 4) return null;
  if (avgContentLength(sections) >= 200) return null;

  return { "2x2": sections.slice(0, 4).map(sectionToLines) };
};

/** Rule 4 & 5: 4+ H2 sections → 2x2 (short) or row-2 (long) */
export const tryH2FourPlusLayout: LayoutRule = (markdown): LayoutMarkdown | null => {
  const sections = splitByH2(markdown);
  if (sections.length < 4) return null;

  if (avgContentLength(sections) < 200) {
    return { "2x2": sections.slice(0, 4).map(sectionToLines) };
  }
  // Long content: fall back to row-2
  return { "row-2": [sectionToLines(sections[0]), sectionToLines(sections[1])] };
};

/** Rule 6: 2+ H2 sections → row-2 */
export const tryH2TwoLayout: LayoutRule = (markdown) => {
  const sections = splitByH2(markdown);
  if (sections.length < 2) return null;

  return { "row-2": [sectionToLines(sections[0]), sectionToLines(sections[1])] };
};

/** All rules in priority order */
const layoutRules: LayoutRule[] = [
  tryCodeBlockLayout,
  tryImageLayout,
  tryH3GridLayout,
  tryH2FourPlusLayout,
  tryH2TwoLayout,
];

// ============================================================================
// Plugin Export
// ============================================================================

export const layoutPlugin: MarkdownPlugin = {
  name: "layout",
  priority: 5, // Lower priority than mermaid (10) - mermaid takes precedence

  toBeat(markdown: string): Partial<MulmoBeat> | null {
    for (const rule of layoutRules) {
      const layoutMarkdown = rule(markdown);
      if (layoutMarkdown) {
        return {
          image: {
            type: "markdown",
            markdown: layoutMarkdown,
          },
        } as Partial<MulmoBeat>;
      }
    }
    return null;
  },
};

export default layoutPlugin;

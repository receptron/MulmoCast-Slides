/**
 * Layout Plugin
 *
 * Auto-detects layout based on markdown content and converts to mulmocast layout format.
 *
 * ## Detection Rules (evaluated in order, first match wins)
 *
 * ### Phase 1: Header Detection
 * If markdown starts with H1 (# Title), extract it as header and analyze remaining content.
 *
 * ┌─────────────────────────────────────┬─────────────────┬─────────────────────────────────┐
 * │ Content Pattern                     │ Layout          │ Conditions                      │
 * ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────┤
 * │ H1 only                             │ header          │ - Only H1, no other content     │
 * │                                     │                 │ - Result: { header: "# ..." }   │
 * ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────┤
 * │ H1 + content (no structure)         │ header+content  │ - H1 + text without H2/H3       │
 * │                                     │                 │ - Result: { header, content }   │
 * ├─────────────────────────────────────┼─────────────────┼─────────────────────────────────┤
 * │ H1 + structured content             │ header+row-2    │ - H1 + content that matches     │
 * │                                     │ header+2x2      │   row-2 or 2x2 rules            │
 * └─────────────────────────────────────┴─────────────────┴─────────────────────────────────┘
 *
 * ### Phase 2: Content Layout Rules (no H1, or applied to content after H1)
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

import type { MarkdownPlugin } from "./types.js";
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

/** Extract H1 header and remaining content */
const extractHeader = (markdown: string): { header: string; content: string } | null => {
  const lines = markdown.split("\n");
  const h1Index = lines.findIndex((line) => /^#\s+/.test(line));
  if (h1Index === -1) return null;

  const header = lines[h1Index];
  const content = [...lines.slice(0, h1Index), ...lines.slice(h1Index + 1)].join("\n").trim();
  return { header, content };
};

/** Check if content has meaningful structure (H2/H3 sections or code/image) */
const hasStructuredContent = (markdown: string): boolean => {
  const h2Sections = splitByH2(markdown);
  const h3Sections = splitByH3(markdown);
  const codeBlocks = extractCodeBlocks(markdown);
  const images = extractImages(markdown);

  return (
    h2Sections.length >= 2 ||
    h3Sections.length >= 4 ||
    codeBlocks.length === 1 ||
    images.length === 1
  );
};

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

/** Content rules (without header) in priority order */
const contentRules: LayoutRule[] = [
  tryCodeBlockLayout,
  tryImageLayout,
  tryH3GridLayout,
  tryH2FourPlusLayout,
  tryH2TwoLayout,
];

/** Apply content rules to markdown */
const applyContentRules = (markdown: string): LayoutMarkdown | null => {
  for (const rule of contentRules) {
    const result = rule(markdown);
    if (result) return result;
  }
  return null;
};

/**
 * Rule 0: H1 header detection → header+content, header+row-2, header+2x2
 *
 * If markdown contains H1:
 * - H1 only → null (no layout, use default markdown)
 * - H1 + unstructured content → { header: "# Title", content: [...] }
 * - H1 + structured content → { header: "# Title", "row-2": [...] } or { header, "2x2": [...] }
 *
 * Note: Schema requires main content (row-2, 2x2, or content), so header-only returns null.
 */
export const tryHeaderLayout: LayoutRule = (markdown): LayoutMarkdown | null => {
  const headerData = extractHeader(markdown);
  if (!headerData) return null;

  const { header, content } = headerData;

  // H1 only (no other content) → no layout (schema requires main content)
  if (!content.trim()) {
    return null;
  }

  // Check if remaining content has structure
  if (hasStructuredContent(content)) {
    const contentLayout = applyContentRules(content);
    if (contentLayout) {
      return { header, ...contentLayout };
    }
  }

  // H1 + unstructured content → header + content
  const contentLines = toLines(content);
  return { header, content: contentLines };
};

/** All rules in priority order (header first, then content rules) */
const layoutRules: LayoutRule[] = [tryHeaderLayout, ...contentRules];

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

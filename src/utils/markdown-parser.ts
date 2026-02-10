/**
 * Markdown Structure Parser
 *
 * Parses markdown into a structured representation for LLM-based
 * presentation planning. Unlike the slide-splitting markdown plugins,
 * this parser preserves the full document structure (heading hierarchy,
 * element types) for intelligent beat allocation by an LLM.
 */

export interface MarkdownElement {
  type: "text" | "table" | "mermaid" | "codeBlock" | "citation" | "image" | "list";
  content: string;
  lang?: string; // for codeBlock
  url?: string; // for citation or image
  alt?: string; // for image
}

export interface MarkdownSection {
  id: string;
  heading: string;
  level: number;
  elements: MarkdownElement[];
  children: string[];
}

export interface ParsedMarkdown {
  frontmatter: Record<string, string> | null;
  sections: MarkdownSection[];
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n/;
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;
const FENCED_CODE_REGEX = /^```(\w*)\s*$/;
const TABLE_ROW_REGEX = /^\|.+\|$/;
const IMAGE_REGEX = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const CITATION_REGEX = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
const LIST_ITEM_REGEX = /^(\s*[-*+]|\s*\d+\.)\s/;

const parseFrontmatter = (
  markdown: string
): { frontmatter: Record<string, string> | null; body: string } => {
  const match = markdown.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: null, body: markdown };
  }

  const yamlBlock = match[1];
  const frontmatter: Record<string, string> = {};
  yamlBlock.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  });

  return { frontmatter, body: markdown.slice(match[0].length) };
};

const extractCitations = (text: string): MarkdownElement[] => {
  const citations: MarkdownElement[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  const regex = new RegExp(CITATION_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    const url = match[2];
    if (!seen.has(url)) {
      seen.add(url);
      citations.push({ type: "citation", content: match[1], url });
    }
  }

  return citations;
};

const collectTableLines = (
  lines: string[],
  startIndex: number
): { content: string; endIndex: number } => {
  const tableLines: string[] = [];
  let i = startIndex;
  while (i < lines.length && TABLE_ROW_REGEX.test(lines[i].trim())) {
    tableLines.push(lines[i]);
    i++;
  }
  return { content: tableLines.join("\n"), endIndex: i };
};

const collectListLines = (
  lines: string[],
  startIndex: number
): { content: string; endIndex: number } => {
  const listLines: string[] = [];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (LIST_ITEM_REGEX.test(line) || (line.startsWith("  ") && listLines.length > 0)) {
      listLines.push(line);
      i++;
    } else if (line.trim() === "" && i + 1 < lines.length && LIST_ITEM_REGEX.test(lines[i + 1])) {
      listLines.push(line);
      i++;
    } else {
      break;
    }
  }
  return { content: listLines.join("\n"), endIndex: i };
};

const collectCodeBlock = (
  lines: string[],
  startIndex: number,
  lang: string
): { element: MarkdownElement; endIndex: number } => {
  const codeLines: string[] = [];
  let i = startIndex + 1;
  while (i < lines.length && !lines[i].trim().startsWith("```")) {
    codeLines.push(lines[i]);
    i++;
  }
  const content = codeLines.join("\n");
  const type = lang === "mermaid" ? "mermaid" : "codeBlock";
  return {
    element: { type, content, ...(type === "codeBlock" ? { lang: lang || undefined } : {}) },
    endIndex: i + 1,
  };
};

const parseElements = (bodyLines: string[]): MarkdownElement[] => {
  const elements: MarkdownElement[] = [];
  const textBuffer: string[] = [];

  const flushText = () => {
    const text = textBuffer.join("\n").trim();
    if (text.length > 0) {
      const citations = extractCitations(text);
      elements.push({ type: "text", content: text });
      citations.forEach((c) => elements.push(c));
    }
    textBuffer.length = 0;
  };

  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    const trimmed = line.trim();

    // Fenced code block
    const codeMatch = trimmed.match(FENCED_CODE_REGEX);
    if (codeMatch) {
      flushText();
      const { element, endIndex } = collectCodeBlock(bodyLines, i, codeMatch[1]);
      elements.push(element);
      i = endIndex;
      continue;
    }

    // Table
    if (TABLE_ROW_REGEX.test(trimmed)) {
      flushText();
      const { content, endIndex } = collectTableLines(bodyLines, i);
      elements.push({ type: "table", content });
      i = endIndex;
      continue;
    }

    // Image (standalone line)
    const imageMatch = trimmed.match(IMAGE_REGEX);
    if (imageMatch) {
      flushText();
      elements.push({ type: "image", content: trimmed, alt: imageMatch[1], url: imageMatch[2] });
      i++;
      continue;
    }

    // List
    if (LIST_ITEM_REGEX.test(line)) {
      flushText();
      const { content, endIndex } = collectListLines(bodyLines, i);
      elements.push({ type: "list", content });
      i = endIndex;
      continue;
    }

    // Regular text
    textBuffer.push(line);
    i++;
  }

  flushText();
  return elements;
};

const generateSectionId = (index: number): string => {
  return `sec-${index}`;
};

export const parseMarkdown = (markdown: string): ParsedMarkdown => {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const lines = body.split("\n");

  const sections: MarkdownSection[] = [];
  let currentBodyLines: string[] = [];
  let currentHeading = "(root)";
  let currentLevel = 0;
  let sectionIndex = 0;

  const flushSection = () => {
    if (currentBodyLines.length > 0 || sectionIndex > 0) {
      sections.push({
        id: generateSectionId(sectionIndex),
        heading: currentHeading,
        level: currentLevel,
        elements: parseElements(currentBodyLines),
        children: [],
      });
      sectionIndex++;
    }
    currentBodyLines = [];
  };

  lines.forEach((line) => {
    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      flushSection();
      currentHeading = headingMatch[2];
      currentLevel = headingMatch[1].length;
    } else {
      currentBodyLines.push(line);
    }
  });

  // Flush the last section
  flushSection();

  // Build parent-child relationships
  buildHierarchy(sections);

  return { frontmatter, sections };
};

const buildHierarchy = (sections: MarkdownSection[]): void => {
  sections.forEach((section, i) => {
    if (section.level === 0) return;

    // Find children: next sections with deeper level until same/shallower level
    for (let j = i + 1; j < sections.length; j++) {
      if (sections[j].level <= section.level) break;
      if (sections[j].level === section.level + 1) {
        section.children.push(sections[j].id);
      }
    }
  });
};

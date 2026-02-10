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
const CITATION_REGEX = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/;
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

const collectWhile = (
  lines: string[],
  startIndex: number,
  predicate: (line: string, count: number, peekNext: string | undefined) => boolean
): { collected: string[]; endIndex: number } => {
  const collected: string[] = [];
  let i = startIndex;
  while (i < lines.length && predicate(lines[i], collected.length, lines[i + 1])) {
    collected.push(lines[i]);
    i++;
  }
  return { collected, endIndex: i };
};

const collectTableLines = (
  lines: string[],
  startIndex: number
): { content: string; endIndex: number } => {
  const { collected, endIndex } = collectWhile(lines, startIndex, (line) =>
    TABLE_ROW_REGEX.test(line.trim())
  );
  return { content: collected.join("\n"), endIndex };
};

const isListContinuation = (line: string, count: number, peekNext: string | undefined): boolean => {
  if (LIST_ITEM_REGEX.test(line)) return true;
  if (line.startsWith("  ") && count > 0) return true;
  if (line.trim() === "" && peekNext !== undefined && LIST_ITEM_REGEX.test(peekNext)) return true;
  return false;
};

const collectListLines = (
  lines: string[],
  startIndex: number
): { content: string; endIndex: number } => {
  const { collected, endIndex } = collectWhile(lines, startIndex, isListContinuation);
  return { content: collected.join("\n"), endIndex };
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
  const closed = i < lines.length;
  const element: MarkdownElement =
    lang === "mermaid"
      ? { type: "mermaid", content }
      : { type: "codeBlock", content, lang: lang || undefined };
  return { element, endIndex: closed ? i + 1 : i };
};

interface ElementParseResult {
  elements: MarkdownElement[];
  endIndex: number;
}

type ElementHandler = (lines: string[], index: number) => ElementParseResult | null;

const handleCodeBlock: ElementHandler = (lines, index) => {
  const codeMatch = lines[index].trim().match(FENCED_CODE_REGEX);
  if (!codeMatch) return null;
  const { element, endIndex } = collectCodeBlock(lines, index, codeMatch[1]);
  return { elements: [element], endIndex };
};

const handleTable: ElementHandler = (lines, index) => {
  if (!TABLE_ROW_REGEX.test(lines[index].trim())) return null;
  const { content, endIndex } = collectTableLines(lines, index);
  return { elements: [{ type: "table", content }], endIndex };
};

const handleImage: ElementHandler = (lines, index) => {
  const trimmed = lines[index].trim();
  const imageMatch = trimmed.match(IMAGE_REGEX);
  if (!imageMatch) return null;
  return {
    elements: [{ type: "image", content: trimmed, alt: imageMatch[1], url: imageMatch[2] }],
    endIndex: index + 1,
  };
};

const handleList: ElementHandler = (lines, index) => {
  if (!LIST_ITEM_REGEX.test(lines[index])) return null;
  const { content, endIndex } = collectListLines(lines, index);
  return { elements: [{ type: "list", content }], endIndex };
};

const ELEMENT_HANDLERS: ElementHandler[] = [handleCodeBlock, handleTable, handleImage, handleList];

const tryHandlers = (lines: string[], index: number): ElementParseResult | null => {
  for (const handler of ELEMENT_HANDLERS) {
    const result = handler(lines, index);
    if (result) return result;
  }
  return null;
};

const flushTextBuffer = (buffer: string[]): MarkdownElement[] => {
  const text = buffer.join("\n").trim();
  if (text.length === 0) return [];
  return [{ type: "text", content: text } as MarkdownElement, ...extractCitations(text)];
};

const parseElements = (bodyLines: string[]): MarkdownElement[] => {
  const elements: MarkdownElement[] = [];
  const textBuffer: string[] = [];
  let i = 0;

  while (i < bodyLines.length) {
    const result = tryHandlers(bodyLines, i);
    if (result) {
      elements.push(...flushTextBuffer(textBuffer));
      textBuffer.length = 0;
      elements.push(...result.elements);
      i = result.endIndex;
    } else {
      textBuffer.push(bodyLines[i]);
      i++;
    }
  }

  elements.push(...flushTextBuffer(textBuffer));
  return elements;
};

const generateSectionId = (index: number): string => {
  return `sec-${index}`;
};

interface RawSection {
  heading: string;
  level: number;
  bodyLines: string[];
}

const splitIntoRawSections = (lines: string[]): RawSection[] => {
  const raw: RawSection[] = [];
  let currentHeading = "(root)";
  let currentLevel = 0;
  let currentBodyLines: string[] = [];

  const flush = () => {
    const hasContent = currentBodyLines.some((line) => line.trim().length > 0);
    if (currentLevel > 0 || hasContent) {
      raw.push({ heading: currentHeading, level: currentLevel, bodyLines: currentBodyLines });
    }
    currentBodyLines = [];
  };

  lines.forEach((line) => {
    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2];
      currentLevel = headingMatch[1].length;
    } else {
      currentBodyLines.push(line);
    }
  });
  flush();
  return raw;
};

const toSection = (raw: RawSection, index: number): MarkdownSection => ({
  id: generateSectionId(index),
  heading: raw.heading,
  level: raw.level,
  elements: parseElements(raw.bodyLines),
  children: [],
});

export const parseMarkdown = (markdown: string): ParsedMarkdown => {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const rawSections = splitIntoRawSections(body.split("\n"));
  const sections = rawSections.map(toSection);
  buildHierarchy(sections);
  return { frontmatter, sections };
};

const findDirectChildIds = (sections: MarkdownSection[], parentIndex: number): string[] => {
  const parentLevel = sections[parentIndex].level;
  const children: string[] = [];
  for (let j = parentIndex + 1; j < sections.length; j++) {
    if (sections[j].level <= parentLevel) break;
    if (sections[j].level === parentLevel + 1) children.push(sections[j].id);
  }
  return children;
};

const buildHierarchy = (sections: MarkdownSection[]): void => {
  sections.forEach((section, i) => {
    if (section.level > 0) section.children = findDirectChildIds(sections, i);
  });
};

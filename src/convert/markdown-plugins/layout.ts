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

// Regex patterns
const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;
const IMAGE_REGEX = /!\[.*?\]\(.*?\)/g;

type LayoutType = "row-2" | "2x2" | "content";

interface ContentAnalysis {
  codeBlocks: string[];
  images: string[];
  h2Sections: Section[];
  h3Sections: Section[];
  textContent: string;
}

interface Section {
  heading: string;
  content: string;
}

/**
 * Extract code blocks from markdown
 */
const extractCodeBlocks = (markdown: string): string[] => {
  const matches = markdown.match(CODE_BLOCK_REGEX) || [];
  return matches.map((block) => block.trim());
};

/**
 * Extract images from markdown
 */
const extractImages = (markdown: string): string[] => {
  const matches = markdown.match(IMAGE_REGEX) || [];
  return matches;
};

/**
 * Extract text content (without code blocks, images, and comments)
 */
const extractTextContent = (markdown: string): string => {
  return markdown
    .replace(CODE_BLOCK_REGEX, "")
    .replace(IMAGE_REGEX, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
};

/**
 * Split markdown by H2 headings into sections
 */
const splitByH2 = (markdown: string): Section[] => {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];

  lines.forEach((line) => {
    if (/^##\s+/.test(line)) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }
      currentHeading = line;
      currentContent = [];
    } else if (currentHeading) {
      currentContent.push(line);
    }
  });

  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
    });
  }

  return sections;
};

/**
 * Split markdown by H3 headings into sections
 */
const splitByH3 = (markdown: string): Section[] => {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];

  lines.forEach((line) => {
    if (/^###\s+/.test(line)) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }
      currentHeading = line;
      currentContent = [];
    } else if (currentHeading) {
      currentContent.push(line);
    }
  });

  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
    });
  }

  return sections;
};

/**
 * Analyze markdown content
 */
const analyzeContent = (markdown: string): ContentAnalysis => {
  return {
    codeBlocks: extractCodeBlocks(markdown),
    images: extractImages(markdown),
    h2Sections: splitByH2(markdown),
    h3Sections: splitByH3(markdown),
    textContent: extractTextContent(markdown),
  };
};

/**
 * Check if content has meaningful text (not just headings)
 */
const hasMeaningfulText = (text: string): boolean => {
  const withoutHeadings = text.replace(/^#{1,6}\s+.+$/gm, "").trim();
  return withoutHeadings.length > 20;
};

/**
 * Determine layout type based on content analysis
 */
const detectLayout = (analysis: ContentAnalysis): LayoutType | null => {
  const { codeBlocks, images, h2Sections, h3Sections, textContent } = analysis;

  // Code block + explanatory text → row-2
  if (codeBlocks.length === 1 && hasMeaningfulText(textContent)) {
    return "row-2";
  }

  // Image + explanatory text → row-2
  if (images.length === 1 && hasMeaningfulText(textContent)) {
    return "row-2";
  }

  // 4+ H3 sections with short content → 2x2
  if (h3Sections.length >= 4) {
    const avgContentLength =
      h3Sections.reduce((sum, s) => sum + s.content.length, 0) / h3Sections.length;
    if (avgContentLength < 200) {
      return "2x2";
    }
  }

  // 4+ H2 sections with short content → 2x2, long content → row-2 fallback
  if (h2Sections.length >= 4) {
    const avgContentLength =
      h2Sections.reduce((sum, s) => sum + s.content.length, 0) / h2Sections.length;
    if (avgContentLength < 200) {
      return "2x2";
    }
    // Long content: fall back to row-2 (uses first 2 sections)
    return "row-2";
  }

  // 2-3 H2 sections → row-2
  if (h2Sections.length >= 2) {
    return "row-2";
  }

  // No special layout detected
  return null;
};

/**
 * Build row-2 layout for code block + text
 */
const buildCodeBlockLayout = (
  markdown: string,
  codeBlock: string
): Record<string, string | string[] | string[][]> => {
  const textContent = markdown
    .replace(codeBlock, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()
    .split("\n")
    .map((line) => line.trimEnd());

  const codeLines = codeBlock.split("\n").map((line) => line.trimEnd());

  return {
    "row-2": [textContent, codeLines],
  };
};

/**
 * Build row-2 layout for image + text
 */
const buildImageLayout = (
  markdown: string,
  image: string
): Record<string, string | string[] | string[][]> => {
  const textContent = markdown
    .replace(image, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()
    .split("\n")
    .map((line) => line.trimEnd());

  return {
    "row-2": [textContent, [image]],
  };
};

/**
 * Build row-2 layout from H2 sections
 */
const buildH2Row2Layout = (sections: Section[]): Record<string, string | string[] | string[][]> => {
  const left = [sections[0].heading, "", sections[0].content]
    .join("\n")
    .split("\n")
    .map((line) => line.trimEnd());

  const right = [sections[1].heading, "", sections[1].content]
    .join("\n")
    .split("\n")
    .map((line) => line.trimEnd());

  return {
    "row-2": [left, right],
  };
};

/**
 * Build 2x2 layout from sections
 */
const build2x2Layout = (sections: Section[]): Record<string, string | string[] | string[][]> => {
  const cells = sections.slice(0, 4).map((section) =>
    [section.heading, "", section.content]
      .join("\n")
      .split("\n")
      .map((line) => line.trimEnd())
  );

  return {
    "2x2": cells,
  };
};

/**
 * Build layout markdown object
 */
const buildLayoutMarkdown = (
  markdown: string,
  layoutType: LayoutType,
  analysis: ContentAnalysis
): Record<string, string | string[] | string[][]> | null => {
  switch (layoutType) {
    case "row-2":
      if (analysis.codeBlocks.length === 1 && hasMeaningfulText(analysis.textContent)) {
        return buildCodeBlockLayout(markdown, analysis.codeBlocks[0]);
      }
      if (analysis.images.length === 1 && hasMeaningfulText(analysis.textContent)) {
        return buildImageLayout(markdown, analysis.images[0]);
      }
      if (analysis.h2Sections.length >= 2) {
        return buildH2Row2Layout(analysis.h2Sections);
      }
      return null;

    case "2x2":
      if (analysis.h3Sections.length >= 4) {
        return build2x2Layout(analysis.h3Sections);
      }
      if (analysis.h2Sections.length >= 4) {
        return build2x2Layout(analysis.h2Sections);
      }
      return null;

    case "content":
    default:
      return null;
  }
};

export const layoutPlugin: MarkdownPlugin = {
  name: "layout",
  priority: 5, // Lower priority than mermaid (10) - mermaid takes precedence

  toBeat(markdown: string): Partial<MulmoBeat> | null {
    const analysis = analyzeContent(markdown);
    const layoutType = detectLayout(analysis);

    if (!layoutType) {
      return null;
    }

    const layoutMarkdown = buildLayoutMarkdown(markdown, layoutType, analysis);
    if (!layoutMarkdown) {
      return null;
    }

    return {
      image: {
        type: "markdown",
        markdown: layoutMarkdown,
      },
    } as Partial<MulmoBeat>;
  },
};

export default layoutPlugin;

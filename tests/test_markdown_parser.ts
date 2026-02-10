import { describe, it } from "node:test";
import assert from "node:assert";
import { parseMarkdown } from "../src/utils/markdown-parser.js";

describe("parseMarkdown", () => {
  describe("frontmatter", () => {
    it("parses YAML frontmatter", () => {
      const md = "---\nname: test\ndescription: A test\n---\n# Title\nBody";
      const result = parseMarkdown(md);
      assert.deepStrictEqual(result.frontmatter, { name: "test", description: "A test" });
    });

    it("returns null when no frontmatter", () => {
      const md = "# Title\nBody";
      const result = parseMarkdown(md);
      assert.strictEqual(result.frontmatter, null);
    });
  });

  describe("sections", () => {
    it("creates sections from headings", () => {
      const md = "# Section 1\nText 1\n# Section 2\nText 2";
      const result = parseMarkdown(md);
      assert.strictEqual(result.sections.length, 2);
      assert.strictEqual(result.sections[0].heading, "Section 1");
      assert.strictEqual(result.sections[1].heading, "Section 2");
    });

    it("assigns sequential IDs", () => {
      const md = "# A\ntext\n# B\ntext";
      const result = parseMarkdown(md);
      assert.strictEqual(result.sections[0].id, "sec-0");
      assert.strictEqual(result.sections[1].id, "sec-1");
    });

    it("captures heading levels", () => {
      const md = "# H1\ntext\n## H2\ntext\n### H3\ntext";
      const result = parseMarkdown(md);
      assert.strictEqual(result.sections[0].level, 1);
      assert.strictEqual(result.sections[1].level, 2);
      assert.strictEqual(result.sections[2].level, 3);
    });

    it("builds parent-child hierarchy", () => {
      const md = "# Parent\ntext\n## Child 1\ntext\n## Child 2\ntext\n### Grandchild\ntext";
      const result = parseMarkdown(md);
      assert.deepStrictEqual(result.sections[0].children, ["sec-1", "sec-2"]);
      assert.deepStrictEqual(result.sections[1].children, []);
      assert.deepStrictEqual(result.sections[2].children, ["sec-3"]);
    });

    it("handles root content before first heading", () => {
      const md = "Some intro text\n# First Heading\nBody";
      const result = parseMarkdown(md);
      assert.strictEqual(result.sections.length, 2);
      assert.strictEqual(result.sections[0].heading, "(root)");
      assert.strictEqual(result.sections[0].level, 0);
    });
  });

  describe("elements: text", () => {
    it("extracts plain text", () => {
      const md = "# Section\nThis is paragraph text.\nMore text.";
      const result = parseMarkdown(md);
      const textElements = result.sections[0].elements.filter((e) => e.type === "text");
      assert.ok(textElements.length > 0);
      assert.ok(textElements[0].content.includes("This is paragraph text."));
    });

    it("handles empty sections", () => {
      const md = "# Empty\n# Next\nSome content";
      const result = parseMarkdown(md);
      assert.strictEqual(result.sections[0].elements.length, 0);
    });
  });

  describe("elements: code blocks", () => {
    it("extracts fenced code blocks with language", () => {
      const md = "# Code\n```typescript\nconst x = 1;\n```";
      const result = parseMarkdown(md);
      const codeElements = result.sections[0].elements.filter((e) => e.type === "codeBlock");
      assert.strictEqual(codeElements.length, 1);
      assert.strictEqual(codeElements[0].lang, "typescript");
      assert.strictEqual(codeElements[0].content, "const x = 1;");
    });

    it("extracts code blocks without language", () => {
      const md = "# Code\n```\nhello\n```";
      const result = parseMarkdown(md);
      const codeElements = result.sections[0].elements.filter((e) => e.type === "codeBlock");
      assert.strictEqual(codeElements.length, 1);
      assert.strictEqual(codeElements[0].content, "hello");
    });
  });

  describe("elements: mermaid", () => {
    it("extracts mermaid blocks as mermaid type", () => {
      const md = "# Diagram\n```mermaid\ngraph LR\n  A --> B\n```";
      const result = parseMarkdown(md);
      const mermaidElements = result.sections[0].elements.filter((e) => e.type === "mermaid");
      assert.strictEqual(mermaidElements.length, 1);
      assert.ok(mermaidElements[0].content.includes("graph LR"));
    });
  });

  describe("elements: tables", () => {
    it("extracts markdown tables", () => {
      const md = "# Data\n| Name | Value |\n| ---- | ----- |\n| A | 1 |\n| B | 2 |";
      const result = parseMarkdown(md);
      const tableElements = result.sections[0].elements.filter((e) => e.type === "table");
      assert.strictEqual(tableElements.length, 1);
      assert.ok(tableElements[0].content.includes("| Name | Value |"));
    });
  });

  describe("elements: images", () => {
    it("extracts standalone images", () => {
      const md = "# Photos\n![Alt text](https://example.com/img.png)";
      const result = parseMarkdown(md);
      const imageElements = result.sections[0].elements.filter((e) => e.type === "image");
      assert.strictEqual(imageElements.length, 1);
      assert.strictEqual(imageElements[0].alt, "Alt text");
      assert.strictEqual(imageElements[0].url, "https://example.com/img.png");
    });
  });

  describe("elements: lists", () => {
    it("extracts bullet lists", () => {
      const md = "# Items\n- Item 1\n- Item 2\n- Item 3";
      const result = parseMarkdown(md);
      const listElements = result.sections[0].elements.filter((e) => e.type === "list");
      assert.strictEqual(listElements.length, 1);
      assert.ok(listElements[0].content.includes("- Item 1"));
    });

    it("extracts numbered lists", () => {
      const md = "# Steps\n1. First\n2. Second";
      const result = parseMarkdown(md);
      const listElements = result.sections[0].elements.filter((e) => e.type === "list");
      assert.strictEqual(listElements.length, 1);
      assert.ok(listElements[0].content.includes("1. First"));
    });
  });

  describe("elements: citations", () => {
    it("extracts URLs from inline links", () => {
      const md = "# Refs\nSee [Google](https://google.com) and [GitHub](https://github.com).";
      const result = parseMarkdown(md);
      const citations = result.sections[0].elements.filter((e) => e.type === "citation");
      assert.strictEqual(citations.length, 2);
      assert.strictEqual(citations[0].url, "https://google.com");
      assert.strictEqual(citations[1].url, "https://github.com");
    });

    it("deduplicates same URL", () => {
      const md = "# Refs\n[A](https://example.com) and [B](https://example.com)";
      const result = parseMarkdown(md);
      const citations = result.sections[0].elements.filter((e) => e.type === "citation");
      assert.strictEqual(citations.length, 1);
    });
  });

  describe("edge cases: empty and minimal input", () => {
    it("returns empty sections for empty string", () => {
      const result = parseMarkdown("");
      assert.strictEqual(result.sections.length, 0);
      assert.strictEqual(result.frontmatter, null);
    });

    it("returns empty sections for frontmatter only", () => {
      const md = "---\ntitle: hello\n---\n";
      const result = parseMarkdown(md);
      assert.deepStrictEqual(result.frontmatter, { title: "hello" });
      assert.strictEqual(result.sections.length, 0);
    });

    it("preserves consecutive blank lines as text", () => {
      const md = "# Section\nLine 1\n\n\nLine 2";
      const result = parseMarkdown(md);
      const textElements = result.sections[0].elements.filter((e) => e.type === "text");
      assert.strictEqual(textElements.length, 1);
      assert.ok(textElements[0].content.includes("Line 1"));
      assert.ok(textElements[0].content.includes("Line 2"));
    });
  });

  describe("edge cases: code blocks", () => {
    it("handles unclosed code block at EOF", () => {
      const md = "# Section\n```python\nprint('hello')\nno closing fence";
      const result = parseMarkdown(md);
      const codeElements = result.sections[0].elements.filter((e) => e.type === "codeBlock");
      assert.strictEqual(codeElements.length, 1);
      assert.ok(codeElements[0].content.includes("print('hello')"));
      assert.ok(codeElements[0].content.includes("no closing fence"));
    });

    it("does not detect table syntax inside code block", () => {
      const md = "# Section\n```\n| Not | A | Table |\n| --- | - | ----- |\n```";
      const result = parseMarkdown(md);
      const tables = result.sections[0].elements.filter((e) => e.type === "table");
      const codeBlocks = result.sections[0].elements.filter((e) => e.type === "codeBlock");
      assert.strictEqual(tables.length, 0);
      assert.strictEqual(codeBlocks.length, 1);
    });

    it("does not detect list syntax inside code block", () => {
      const md = "# Section\n```\n- not a list\n- just code\n```";
      const result = parseMarkdown(md);
      const lists = result.sections[0].elements.filter((e) => e.type === "list");
      const codeBlocks = result.sections[0].elements.filter((e) => e.type === "codeBlock");
      assert.strictEqual(lists.length, 0);
      assert.strictEqual(codeBlocks.length, 1);
    });

    it("does not detect heading syntax inside code block", () => {
      const md = "# Real Section\n```\n# Not a heading\n## Also not a heading\n```\nAfter code";
      const result = parseMarkdown(md);
      assert.strictEqual(result.sections.length, 1);
      assert.strictEqual(result.sections[0].heading, "Real Section");
      const codeBlocks = result.sections[0].elements.filter((e) => e.type === "codeBlock");
      assert.strictEqual(codeBlocks.length, 1);
      assert.ok(codeBlocks[0].content.includes("# Not a heading"));
    });
  });

  describe("edge cases: tables", () => {
    it("separates text before and after a table", () => {
      const md = "# Section\nBefore table\n| A | B |\n| - | - |\n| 1 | 2 |\nAfter table";
      const result = parseMarkdown(md);
      const types = result.sections[0].elements.map((e) => e.type);
      assert.deepStrictEqual(
        types.filter((t) => t === "text" || t === "table"),
        ["text", "table", "text"],
      );
    });
  });

  describe("edge cases: lists", () => {
    it("groups nested/indented items into one list", () => {
      const md = "# Section\n- Item 1\n  - Sub 1\n  - Sub 2\n- Item 2";
      const result = parseMarkdown(md);
      const lists = result.sections[0].elements.filter((e) => e.type === "list");
      assert.strictEqual(lists.length, 1);
      assert.ok(lists[0].content.includes("Sub 1"));
      assert.ok(lists[0].content.includes("Item 2"));
    });
  });

  describe("edge cases: images", () => {
    it("treats inline image (non-standalone) as text", () => {
      const md = "# Section\nText before ![alt](url.png) text after";
      const result = parseMarkdown(md);
      const images = result.sections[0].elements.filter((e) => e.type === "image");
      const texts = result.sections[0].elements.filter((e) => e.type === "text");
      assert.strictEqual(images.length, 0);
      assert.ok(texts.length > 0);
      assert.ok(texts[0].content.includes("![alt](url.png)"));
    });
  });

  describe("edge cases: sections and headings", () => {
    it("creates root section for content before first heading", () => {
      const md = "Root content here\n# First Heading\nBody";
      const result = parseMarkdown(md);
      assert.strictEqual(result.sections[0].id, "sec-0");
      assert.strictEqual(result.sections[0].level, 0);
      assert.strictEqual(result.sections[0].heading, "(root)");
      assert.ok(result.sections[0].elements.some((e) => e.content.includes("Root content")));
    });

    it("handles H6 (maximum heading level)", () => {
      const md = "###### Deep Heading\nDeep content";
      const result = parseMarkdown(md);
      assert.strictEqual(result.sections[0].level, 6);
      assert.strictEqual(result.sections[0].heading, "Deep Heading");
    });

    it("preserves inline formatting in headings", () => {
      const md = "# **Bold** and *italic* heading\nBody";
      const result = parseMarkdown(md);
      assert.strictEqual(result.sections[0].heading, "**Bold** and *italic* heading");
    });
  });

  describe("complex document", () => {
    it("parses a multi-section document with mixed elements", () => {
      const md = `---
name: test
---
# Introduction

Some intro text with [a link](https://example.com).

## Architecture

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

| Component | Role |
| --------- | ---- |
| API | Backend |

## Implementation

\`\`\`typescript
const api = new API();
\`\`\`

- Step 1
- Step 2

![Diagram](./img.png)
`;
      const result = parseMarkdown(md);
      assert.deepStrictEqual(result.frontmatter, { name: "test" });
      assert.strictEqual(result.sections.length, 3);

      // Introduction
      assert.strictEqual(result.sections[0].heading, "Introduction");
      const introTypes = result.sections[0].elements.map((e) => e.type);
      assert.ok(introTypes.includes("text"));
      assert.ok(introTypes.includes("citation"));

      // Architecture
      assert.strictEqual(result.sections[1].heading, "Architecture");
      const archTypes = result.sections[1].elements.map((e) => e.type);
      assert.ok(archTypes.includes("mermaid"));
      assert.ok(archTypes.includes("table"));

      // Implementation
      assert.strictEqual(result.sections[2].heading, "Implementation");
      const implTypes = result.sections[2].elements.map((e) => e.type);
      assert.ok(implTypes.includes("codeBlock"));
      assert.ok(implTypes.includes("list"));
      assert.ok(implTypes.includes("image"));
    });
  });
});

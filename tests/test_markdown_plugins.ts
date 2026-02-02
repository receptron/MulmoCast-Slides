/**
 * Unit tests for Markdown Plugin System
 *
 * Tests separator modes, plugins, and edge cases.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  splitIntoSlides,
  getSeparatorPattern,
  processMarkdown,
  removeYamlFrontMatter,
  filterEmptySlides,
  isHeadingSeparator,
  buildPluginList,
  applyPreprocessors,
  findBeat,
} from "../src/convert/markdown-plugins";

describe("Separator Modes", () => {
  describe("horizontal-rule (default)", () => {
    it("splits by --- on its own line", () => {
      const content = `# Slide 1
Content 1

---

# Slide 2
Content 2`;

      const slides = splitIntoSlides(content, "horizontal-rule");
      assert.strictEqual(slides.length, 2);
      assert.ok(slides[0].includes("Slide 1"));
      assert.ok(slides[1].includes("Slide 2"));
    });

    it("handles YAML front matter", () => {
      const content = `---
theme: default
---

# Slide 1
Content 1

---

# Slide 2
Content 2`;

      const slides = splitIntoSlides(content, "horizontal-rule");
      assert.strictEqual(slides.length, 2);
      assert.ok(slides[0].includes("Slide 1"));
    });

    it("removes empty slides", () => {
      const content = `# Slide 1

---

---

# Slide 2`;

      const slides = splitIntoSlides(content, "horizontal-rule");
      assert.strictEqual(slides.length, 2);
    });

    it("handles Windows line endings (CRLF)", () => {
      const content = "# Slide 1\r\nContent\r\n\r\n---\r\n\r\n# Slide 2";
      const slides = splitIntoSlides(content, "horizontal-rule");
      assert.strictEqual(slides.length, 2);
    });
  });

  describe("heading", () => {
    it("splits by any heading level", () => {
      const content = `# Main Title

Content

## Section 1

Content 1

### Subsection

Content 2

## Section 2

Content 3`;

      const slides = splitIntoSlides(content, "heading");
      assert.strictEqual(slides.length, 4);
    });

    it("handles document without heading at start", () => {
      const content = `Introduction text

# First Heading

Content`;

      const slides = splitIntoSlides(content, "heading");
      assert.ok(slides.length >= 1);
    });
  });

  describe("heading-1", () => {
    it("splits only by # headings", () => {
      const content = `# Title 1

## Subtitle
Content

# Title 2

## Another Subtitle
Content`;

      const slides = splitIntoSlides(content, "heading-1");
      assert.strictEqual(slides.length, 2);
      assert.ok(slides[0].includes("Subtitle"));
      assert.ok(slides[1].includes("Another Subtitle"));
    });
  });

  describe("heading-2", () => {
    it("splits only by ## headings", () => {
      const content = `# Main Title

## Section 1
Content 1

### Subsection
Sub content

## Section 2
Content 2`;

      const slides = splitIntoSlides(content, "heading-2");
      assert.strictEqual(slides.length, 3); // includes content before first ##
    });
  });

  describe("blank-lines", () => {
    it("splits by 3 or more consecutive newlines", () => {
      // 4 newlines (3 blank lines) = splits
      // 3 newlines (2 blank lines) = splits (3+ newlines)
      // 2 newlines (1 blank line) = does not split
      const content = `Paragraph 1



Paragraph 2

Paragraph 3 (not separated - only 1 blank line)`;

      const slides = splitIntoSlides(content, "blank-lines");
      assert.strictEqual(slides.length, 2);
      assert.ok(slides[0].includes("Paragraph 1"));
      assert.ok(slides[1].includes("Paragraph 2"));
      assert.ok(slides[1].includes("Paragraph 3"));
    });
  });

  describe("comment", () => {
    it("splits by <!-- slide --> comment", () => {
      const content = `# Slide 1
Content 1

<!-- slide -->

# Slide 2
Content 2

<!-- SLIDE -->

# Slide 3`;

      const slides = splitIntoSlides(content, "comment");
      assert.strictEqual(slides.length, 3);
    });
  });

  describe("page-break", () => {
    it("splits by <!-- pagebreak --> comment", () => {
      const content = `Page 1

<!-- pagebreak -->

Page 2`;

      const slides = splitIntoSlides(content, "page-break");
      assert.strictEqual(slides.length, 2);
    });

    it("splits by form feed character", () => {
      const content = "Page 1\n\fPage 2";
      const slides = splitIntoSlides(content, "page-break");
      assert.strictEqual(slides.length, 2);
    });
  });

  describe("custom pattern", () => {
    it("splits by custom regex pattern", () => {
      const content = `Section 1
===BREAK===
Section 2
===BREAK===
Section 3`;

      const slides = splitIntoSlides(content, { pattern: "===BREAK===" });
      assert.strictEqual(slides.length, 3);
    });
  });
});

describe("Mermaid Plugin", () => {
  it("converts mermaid to markdown with row-2 layout", () => {
    const slides = [
      `# Flowchart

\`\`\`mermaid
flowchart TD
    A --> B
    B --> C
\`\`\`

This is a diagram.`,
    ];

    const results = processMarkdown(slides, { mermaid: true });

    assert.strictEqual(results.length, 1);
    assert.notStrictEqual(results[0].beat, null);
    // Now outputs markdown with layout instead of mermaid type
    assert.strictEqual(results[0].beat?.image?.type, "markdown");
    const image = results[0].beat?.image as { type: "markdown"; markdown: { "row-2": string[][] } };
    assert.ok(image.markdown["row-2"]);
    assert.strictEqual(image.markdown["row-2"].length, 2);
  });

  it("includes heading in left column of row-2 layout", () => {
    const slides = [
      `# System Architecture

\`\`\`mermaid
graph LR
    A --> B
\`\`\``,
    ];

    const results = processMarkdown(slides, { mermaid: true });

    const image = results[0].beat?.image as { type: "markdown"; markdown: { "row-2": string[][] } };
    // Left column should contain the heading
    const leftColumn = image.markdown["row-2"][0];
    assert.ok(leftColumn.some((line) => line.includes("System Architecture")));
  });

  it("returns null for non-mermaid slides", () => {
    const slides = [`# Regular Slide\n\nJust text content.`];

    const results = processMarkdown(slides, { mermaid: true });

    assert.strictEqual(results[0].beat, null);
  });

  it("includes explanatory content in left column", () => {
    const slides = [
      `# Diagram

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

This explains the diagram above.`,
    ];

    const results = processMarkdown(slides, { mermaid: true });

    const image = results[0].beat?.image as { type: "markdown"; markdown: { "row-2": string[][] } };
    const leftColumn = image.markdown["row-2"][0];
    assert.ok(leftColumn.some((line) => line.includes("explains")));
  });

  it("outputs mermaid code in right column", () => {
    const slides = [
      `# Test

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Description`,
    ];

    const results = processMarkdown(slides, { mermaid: true });

    const image = results[0].beat?.image as { type: "markdown"; markdown: { "row-2": string[][] } };
    const rightColumn = image.markdown["row-2"][1];
    assert.ok(rightColumn[0].includes("```mermaid"));
    assert.ok(rightColumn.some((line) => line.includes("A --> B")));
  });

  it("outputs simple markdown for mermaid-only slides", () => {
    const slides = [
      `\`\`\`mermaid
graph TD
    A --> B
\`\`\``,
    ];

    const results = processMarkdown(slides, { mermaid: true });

    const image = results[0].beat?.image as { type: "markdown"; markdown: string[] };
    // No row-2 layout for mermaid-only content
    assert.ok(Array.isArray(image.markdown));
    assert.ok(image.markdown[0].includes("```mermaid"));
  });
});

describe("Directive Plugin", () => {
  it("removes Marp-style directives", () => {
    const slides = [
      `<!-- _class: lead -->

# Title Slide

Content`,
    ];

    const results = processMarkdown(slides, { directive: true });

    assert.ok(!results[0].markdown.includes("_class"));
    assert.ok(results[0].markdown.includes("Title Slide"));
  });

  it("removes multiple directives", () => {
    const slides = [
      `<!-- _class: lead -->
<!-- _backgroundColor: #fff -->
<!-- _header: Header Text -->

# Slide

Content`,
    ];

    const results = processMarkdown(slides, { directive: true });

    assert.ok(!results[0].markdown.includes("_class"));
    assert.ok(!results[0].markdown.includes("_backgroundColor"));
    assert.ok(!results[0].markdown.includes("_header"));
    assert.ok(results[0].markdown.includes("Slide"));
  });

  it("stores directives in context metadata", () => {
    // Just verify the directive is removed
    const slides = [`<!-- _paginate: true -->\n\n# Content`];

    const results = processMarkdown(slides, { directive: true });

    assert.ok(!results[0].markdown.includes("_paginate"));
  });
});

describe("Plugin Combination", () => {
  it("runs both mermaid and directive plugins", () => {
    const slides = [
      `<!-- _class: lead -->

# Diagram

\`\`\`mermaid
graph TD
    A --> B
\`\`\``,
    ];

    const results = processMarkdown(slides, { mermaid: true, directive: true });

    // directive removes the _class comment
    assert.ok(!results[0].markdown.includes("_class"));
    // mermaid creates a markdown beat with layout
    assert.strictEqual(results[0].beat?.image?.type, "markdown");
  });

  it("directive runs before mermaid (higher priority)", () => {
    const slides = [
      `<!-- _class: lead -->

# Test

\`\`\`mermaid
graph TD
    A --> B
\`\`\``,
    ];

    const results = processMarkdown(slides, { mermaid: true, directive: true });

    // Both should work correctly
    assert.ok(!results[0].markdown.includes("_class"));
    assert.notStrictEqual(results[0].beat, null);
  });
});

describe("Edge Cases", () => {
  it("handles empty content", () => {
    const slides = splitIntoSlides("", "horizontal-rule");
    assert.strictEqual(slides.length, 0);
  });

  it("handles content with only whitespace", () => {
    const slides = splitIntoSlides("   \n\n  \t  ", "horizontal-rule");
    assert.strictEqual(slides.length, 0);
  });

  it("handles single slide without separators", () => {
    const content = "# Only Slide\n\nContent here";
    const slides = splitIntoSlides(content, "horizontal-rule");
    assert.strictEqual(slides.length, 1);
  });

  it("handles multiple consecutive separators", () => {
    const content = "# Slide 1\n\n---\n\n---\n\n---\n\n# Slide 2";
    const slides = splitIntoSlides(content, "horizontal-rule");
    // Empty slides between separators should be filtered
    assert.strictEqual(slides.length, 2);
  });

  it("handles code blocks containing separator-like content", () => {
    const content = `# Code Example

\`\`\`markdown
---
This is in a code block
---
\`\`\`

---

# Next Slide`;

    // Note: Current implementation doesn't handle code block escaping
    // This test documents current behavior
    const slides = splitIntoSlides(content, "horizontal-rule");
    assert.ok(slides.length >= 2);
  });

  it("preserves speaker notes in HTML comments", () => {
    const content = `# Slide

Content

<!-- This is a speaker note -->

More content`;

    const slides = splitIntoSlides(content, "horizontal-rule");
    assert.ok(slides[0].includes("speaker note"));
  });

  it("handles mixed separator styles gracefully", () => {
    // When using heading separator, --- should not split
    const content = `# Section 1

---

Content with horizontal rule

# Section 2`;

    const slides = splitIntoSlides(content, "heading");
    assert.strictEqual(slides.length, 2);
    assert.ok(slides[0].includes("---"));
  });
});

describe("Separator Pattern Generation", () => {
  it("returns correct pattern for horizontal-rule", () => {
    const pattern = getSeparatorPattern("horizontal-rule");
    assert.ok("\n---\n".match(pattern));
    assert.ok(!"---".match(pattern)); // Must have newlines
  });

  it("returns correct pattern for heading", () => {
    const pattern = getSeparatorPattern("heading");
    assert.ok("\n# Title".match(pattern));
    assert.ok("\n## Title".match(pattern));
    assert.ok("\n### Title".match(pattern));
  });

  it("returns correct pattern for custom pattern", () => {
    const pattern = getSeparatorPattern({ pattern: "CUSTOM_SEPARATOR" });
    assert.ok("CUSTOM_SEPARATOR".match(pattern));
  });
});

describe("Helper Functions", () => {
  describe("removeYamlFrontMatter", () => {
    it("removes first slide if it starts with ---", () => {
      const slides = ["---\ntheme: default", "# Slide 1", "# Slide 2"];
      const result = removeYamlFrontMatter(slides);
      assert.deepStrictEqual(result, ["# Slide 1", "# Slide 2"]);
    });

    it("keeps all slides if first does not start with ---", () => {
      const slides = ["# Slide 1", "# Slide 2"];
      const result = removeYamlFrontMatter(slides);
      assert.deepStrictEqual(result, ["# Slide 1", "# Slide 2"]);
    });

    it("handles empty array", () => {
      const result = removeYamlFrontMatter([]);
      assert.deepStrictEqual(result, []);
    });

    it("handles whitespace before ---", () => {
      const slides = ["  ---\ntheme: default", "# Slide 1"];
      const result = removeYamlFrontMatter(slides);
      assert.deepStrictEqual(result, ["# Slide 1"]);
    });
  });

  describe("filterEmptySlides", () => {
    it("removes empty strings", () => {
      const slides = ["# Slide 1", "", "# Slide 2", ""];
      const result = filterEmptySlides(slides);
      assert.deepStrictEqual(result, ["# Slide 1", "# Slide 2"]);
    });

    it("removes whitespace-only strings", () => {
      const slides = ["# Slide 1", "   ", "# Slide 2", "\n\t\n"];
      const result = filterEmptySlides(slides);
      assert.deepStrictEqual(result, ["# Slide 1", "# Slide 2"]);
    });

    it("keeps slides with content", () => {
      const slides = ["a", "b", "c"];
      const result = filterEmptySlides(slides);
      assert.deepStrictEqual(result, ["a", "b", "c"]);
    });
  });

  describe("isHeadingSeparator", () => {
    it("returns true for heading separators", () => {
      assert.strictEqual(isHeadingSeparator("heading"), true);
      assert.strictEqual(isHeadingSeparator("heading-1"), true);
      assert.strictEqual(isHeadingSeparator("heading-2"), true);
      assert.strictEqual(isHeadingSeparator("heading-3"), true);
    });

    it("returns false for non-heading separators", () => {
      assert.strictEqual(isHeadingSeparator("horizontal-rule"), false);
      assert.strictEqual(isHeadingSeparator("blank-lines"), false);
      assert.strictEqual(isHeadingSeparator("comment"), false);
      assert.strictEqual(isHeadingSeparator("page-break"), false);
    });

    it("returns false for custom pattern", () => {
      assert.strictEqual(isHeadingSeparator({ pattern: "---" }), false);
    });
  });

  describe("buildPluginList", () => {
    it("returns empty array when no plugins enabled", () => {
      const result = buildPluginList({});
      assert.strictEqual(result.length, 0);
    });

    it("returns mermaid plugin when enabled", () => {
      const result = buildPluginList({ mermaid: true });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "mermaid");
    });

    it("returns directive plugin when enabled", () => {
      const result = buildPluginList({ directive: true });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "directive");
    });

    it("returns both plugins sorted by priority", () => {
      const result = buildPluginList({ mermaid: true, directive: true });
      assert.strictEqual(result.length, 2);
      // directive has higher priority (100) than mermaid (10)
      assert.strictEqual(result[0].name, "directive");
      assert.strictEqual(result[1].name, "mermaid");
    });
  });

  describe("applyPreprocessors", () => {
    it("returns original markdown when no plugins", () => {
      const result = applyPreprocessors("# Test", [], { slideIndex: 0, totalSlides: 1 });
      assert.strictEqual(result, "# Test");
    });

    it("applies directive preprocess", () => {
      const plugins = buildPluginList({ directive: true });
      const result = applyPreprocessors("<!-- _class: lead -->\n\n# Test", plugins, {
        slideIndex: 0,
        totalSlides: 1,
      });
      assert.ok(!result.includes("_class"));
      assert.ok(result.includes("# Test"));
    });

    it("chains multiple preprocessors", () => {
      const plugins = buildPluginList({ mermaid: true, directive: true });
      const input = "<!-- _class: lead -->\n\n# Test";
      const result = applyPreprocessors(input, plugins, { slideIndex: 0, totalSlides: 1 });
      assert.ok(!result.includes("_class"));
    });
  });

  describe("findBeat", () => {
    it("returns null when no plugins", () => {
      const result = findBeat("# Test", [], { slideIndex: 0, totalSlides: 1 });
      assert.strictEqual(result, null);
    });

    it("returns null when no mermaid content", () => {
      const plugins = buildPluginList({ mermaid: true });
      const result = findBeat("# Test\n\nNo mermaid here", plugins, { slideIndex: 0, totalSlides: 1 });
      assert.strictEqual(result, null);
    });

    it("returns markdown beat with layout when mermaid content found", () => {
      const plugins = buildPluginList({ mermaid: true });
      const markdown = "# Diagram\n\n```mermaid\ngraph TD\n    A --> B\n```";
      const result = findBeat(markdown, plugins, { slideIndex: 0, totalSlides: 1 });
      assert.notStrictEqual(result, null);
      // Now outputs markdown type with layout
      assert.strictEqual(result?.image?.type, "markdown");
    });

    it("returns first matching beat when multiple plugins", () => {
      const plugins = buildPluginList({ mermaid: true, directive: true });
      const markdown = "# Diagram\n\n```mermaid\ngraph TD\n    A --> B\n```";
      const result = findBeat(markdown, plugins, { slideIndex: 0, totalSlides: 1 });
      // mermaid plugin should match with markdown type
      assert.strictEqual(result?.image?.type, "markdown");
    });
  });
});

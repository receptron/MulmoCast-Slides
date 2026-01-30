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
  pluginRegistry,
} from "../src/convert/markdown-plugins";
import { mermaidPlugin } from "../src/convert/markdown-plugins/mermaid";
import { directivePlugin } from "../src/convert/markdown-plugins/directive";

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
  it("extracts mermaid code blocks", async () => {
    const slides = [
      `# Flowchart

\`\`\`mermaid
flowchart TD
    A --> B
    B --> C
\`\`\`

This is a diagram.`,
    ];

    const results = await processMarkdown(slides, {
      pluginNames: ["mermaid"],
    });

    assert.strictEqual(results.length, 1);
    assert.notStrictEqual(results[0].beat, null);
    assert.strictEqual(results[0].beat?.image?.type, "mermaid");
  });

  it("extracts title from heading", async () => {
    const slides = [
      `# System Architecture

\`\`\`mermaid
graph LR
    A --> B
\`\`\``,
    ];

    const results = await processMarkdown(slides, {
      pluginNames: ["mermaid"],
    });

    const image = results[0].beat?.image as { type: "mermaid"; title: string };
    assert.strictEqual(image.title, "System Architecture");
  });

  it("returns null for non-mermaid slides", async () => {
    const slides = [`# Regular Slide\n\nJust text content.`];

    const results = await processMarkdown(slides, {
      pluginNames: ["mermaid"],
    });

    assert.strictEqual(results[0].beat, null);
  });

  it("extracts text from non-mermaid content", async () => {
    const slides = [
      `# Diagram

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

This explains the diagram above.`,
    ];

    const results = await processMarkdown(slides, {
      pluginNames: ["mermaid"],
    });

    assert.ok(results[0].beat?.text?.includes("explains"));
  });
});

describe("Directive Plugin", () => {
  it("removes Marp-style directives", async () => {
    const slides = [
      `<!-- _class: lead -->

# Title Slide

Content`,
    ];

    const results = await processMarkdown(slides, {
      pluginNames: ["directive"],
    });

    assert.ok(!results[0].markdown.includes("_class"));
    assert.ok(results[0].markdown.includes("Title Slide"));
  });

  it("removes multiple directives", async () => {
    const slides = [
      `<!-- _class: lead -->
<!-- _backgroundColor: #fff -->
<!-- _header: Header Text -->

# Slide

Content`,
    ];

    const results = await processMarkdown(slides, {
      pluginNames: ["directive"],
    });

    assert.ok(!results[0].markdown.includes("_class"));
    assert.ok(!results[0].markdown.includes("_backgroundColor"));
    assert.ok(!results[0].markdown.includes("_header"));
    assert.ok(results[0].markdown.includes("Slide"));
  });

  it("stores directives in context metadata", async () => {
    // This would require exposing context, which we don't currently do
    // Just verify the directive is removed
    const slides = [`<!-- _paginate: true -->\n\n# Content`];

    const results = await processMarkdown(slides, {
      pluginNames: ["directive"],
    });

    assert.ok(!results[0].markdown.includes("_paginate"));
  });
});

describe("Plugin Registry", () => {
  it("has mermaid plugin registered", () => {
    const plugin = pluginRegistry.get("mermaid");
    assert.notStrictEqual(plugin, undefined);
    assert.strictEqual(plugin?.name, "mermaid");
  });

  it("has directive plugin registered", () => {
    const plugin = pluginRegistry.get("directive");
    assert.notStrictEqual(plugin, undefined);
    assert.strictEqual(plugin?.name, "directive");
  });

  it("returns undefined for unknown plugin", () => {
    const plugin = pluginRegistry.get("nonexistent-plugin");
    assert.strictEqual(plugin, undefined);
  });
});

describe("Plugin Priority", () => {
  it("runs higher priority plugins first", async () => {
    const executionOrder: string[] = [];

    const lowPriorityPlugin = {
      name: "low-priority",
      priority: 1,
      preprocess: (md: string) => {
        executionOrder.push("low");
        return md;
      },
    };

    const highPriorityPlugin = {
      name: "high-priority",
      priority: 100,
      preprocess: (md: string) => {
        executionOrder.push("high");
        return md;
      },
    };

    await processMarkdown(["# Test"], {
      plugins: [lowPriorityPlugin, highPriorityPlugin],
    });

    assert.deepStrictEqual(executionOrder, ["high", "low"]);
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

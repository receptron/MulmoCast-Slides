/**
 * Layout Plugin Unit Tests
 *
 * Tests for auto-detection of layout based on markdown content.
 * Each rule is tested individually with its spec documented.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  layoutPlugin,
  tryCodeBlockLayout,
  tryImageLayout,
  tryH3GridLayout,
  tryH2FourPlusLayout,
  tryH2TwoLayout,
} from "../src/convert/markdown-plugins/layout";

// Helper to extract layout type from result
const getLayoutType = (result: Record<string, unknown> | null): "row-2" | "2x2" | null => {
  if (!result) return null;
  if ("row-2" in result) return "row-2";
  if ("2x2" in result) return "2x2";
  return null;
};

// Helper to get section count from layout
const getSectionCount = (result: Record<string, unknown> | null): number => {
  if (!result) return 0;
  if ("row-2" in result) return (result["row-2"] as unknown[]).length;
  if ("2x2" in result) return (result["2x2"] as unknown[]).length;
  return 0;
};

// ============================================================================
// Rule 1: tryCodeBlockLayout
// ============================================================================
describe("Rule 1: tryCodeBlockLayout", () => {
  /**
   * SPEC: Single code block + meaningful text → row-2
   *
   * Conditions:
   * - Exactly 1 code block (```)
   * - Text content (excluding code, images, comments) > 20 chars
   *
   * Result: { "row-2": [textLines, codeLines] }
   */

  it("should return row-2 when single code block with meaningful text (> 20 chars)", () => {
    const markdown = `
## Overview

GraphAI is a declarative workflow engine that enables parallel processing.

\`\`\`typescript
const graph = new GraphAI({});
await graph.run();
\`\`\`
`;
    const result = tryCodeBlockLayout(markdown);

    assert.strictEqual(getLayoutType(result), "row-2");
    assert.strictEqual(getSectionCount(result), 2);
  });

  it("should return null when no code block", () => {
    const markdown = `
## Overview

This is just text without any code blocks.
`;
    const result = tryCodeBlockLayout(markdown);

    assert.strictEqual(result, null);
  });

  it("should return null when multiple code blocks", () => {
    const markdown = `
## Examples

\`\`\`typescript
const a = 1;
\`\`\`

\`\`\`typescript
const b = 2;
\`\`\`
`;
    const result = tryCodeBlockLayout(markdown);

    assert.strictEqual(result, null);
  });

  it("should return null when text content <= 20 chars", () => {
    const markdown = `
## Code

\`\`\`typescript
const x = 1;
\`\`\`
`;
    const result = tryCodeBlockLayout(markdown);

    // "Code" heading only → not meaningful text
    assert.strictEqual(result, null);
  });

  it("should return null when text content is exactly 20 chars (boundary)", () => {
    const markdown = `
This is exactly text

\`\`\`typescript
const x = 1;
\`\`\`
`;
    const result = tryCodeBlockLayout(markdown);

    // "This is exactly text" = 20 chars, need > 20
    assert.strictEqual(result, null);
  });

  it("should return row-2 when text content is 21 chars (boundary)", () => {
    const markdown = `
This is exactly text!

\`\`\`typescript
const x = 1;
\`\`\`
`;
    const result = tryCodeBlockLayout(markdown);

    // "This is exactly text!" = 21 chars, > 20 threshold
    assert.strictEqual(getLayoutType(result), "row-2");
  });

  it("should handle code block with different languages", () => {
    const markdown = `
## Python Example

Here is how to use the library in Python for data processing tasks.

\`\`\`python
import graphai
graph = graphai.Graph()
graph.run()
\`\`\`
`;
    const result = tryCodeBlockLayout(markdown);

    assert.strictEqual(getLayoutType(result), "row-2");
  });

  it("should handle code block without language specifier", () => {
    const markdown = `
## Code Sample

This is a generic code sample showing the basic structure of the code.

\`\`\`
const x = 1;
console.log(x);
\`\`\`
`;
    const result = tryCodeBlockLayout(markdown);

    assert.strictEqual(getLayoutType(result), "row-2");
  });
});

// ============================================================================
// Rule 2: tryImageLayout
// ============================================================================
describe("Rule 2: tryImageLayout", () => {
  /**
   * SPEC: Single image + meaningful text → row-2
   *
   * Conditions:
   * - Exactly 1 image (![]())
   * - Text content (excluding code, images, comments) > 20 chars
   *
   * Result: { "row-2": [textLines, [imageMarkdown]] }
   */

  it("should return row-2 when single image with meaningful text", () => {
    const markdown = `
## Screenshot

This is a screenshot of the application showing the main dashboard interface.

![Dashboard](https://example.com/dashboard.png)
`;
    const result = tryImageLayout(markdown);

    assert.strictEqual(getLayoutType(result), "row-2");
    assert.strictEqual(getSectionCount(result), 2);
  });

  it("should return null when no image", () => {
    const markdown = `
## Description

This is just text without any images at all.
`;
    const result = tryImageLayout(markdown);

    assert.strictEqual(result, null);
  });

  it("should return null when multiple images", () => {
    const markdown = `
## Gallery

Here are some screenshots.

![Image 1](https://example.com/1.png)
![Image 2](https://example.com/2.png)
`;
    const result = tryImageLayout(markdown);

    assert.strictEqual(result, null);
  });

  it("should return null when text content <= 20 chars", () => {
    const markdown = `
## Pic

![Image](https://example.com/image.png)
`;
    const result = tryImageLayout(markdown);

    assert.strictEqual(result, null);
  });

  it("should handle image with special characters in alt text", () => {
    const markdown = `
## Architecture Diagram

This diagram shows the system architecture with all components and their connections.

![System [v2.0] - Architecture](https://example.com/arch.png)
`;
    const result = tryImageLayout(markdown);

    assert.strictEqual(getLayoutType(result), "row-2");
  });
});

// ============================================================================
// Rule 3: tryH3GridLayout
// ============================================================================
describe("Rule 3: tryH3GridLayout", () => {
  /**
   * SPEC: 4+ H3 sections with short content → 2x2
   *
   * Conditions:
   * - 4 or more ### headings
   * - Average content length < 200 chars
   *
   * Result: { "2x2": [first 4 sections as line arrays] }
   */

  it("should return 2x2 when 4 H3 sections with short content", () => {
    const markdown = `
### Item 1
Value: 100

### Item 2
Value: 200

### Item 3
Value: 300

### Item 4
Value: 400
`;
    const result = tryH3GridLayout(markdown);

    assert.strictEqual(getLayoutType(result), "2x2");
    assert.strictEqual(getSectionCount(result), 4);
  });

  it("should return 2x2 using first 4 when 5+ H3 sections", () => {
    const markdown = `
### A
Content A

### B
Content B

### C
Content C

### D
Content D

### E
Content E (should be ignored)
`;
    const result = tryH3GridLayout(markdown);

    assert.strictEqual(getLayoutType(result), "2x2");
    assert.strictEqual(getSectionCount(result), 4);
  });

  it("should return null when only 3 H3 sections", () => {
    const markdown = `
### Item 1
Value: 100

### Item 2
Value: 200

### Item 3
Value: 300
`;
    const result = tryH3GridLayout(markdown);

    assert.strictEqual(result, null);
  });

  it("should return null when 4 H3 sections with long content (avg >= 200)", () => {
    const longContent = `
This is an extremely long section that contains a tremendous amount of detailed information.
We need to make absolutely sure that this content exceeds the 200 character threshold that
determines whether sections are considered "short" for 2x2 layout purposes.
`;
    const markdown = `
### Section 1
${longContent}

### Section 2
${longContent}

### Section 3
${longContent}

### Section 4
${longContent}
`;
    const result = tryH3GridLayout(markdown);

    assert.strictEqual(result, null);
  });
});

// ============================================================================
// Rule 4 & 5: tryH2FourPlusLayout
// ============================================================================
describe("Rule 4 & 5: tryH2FourPlusLayout", () => {
  /**
   * SPEC: 4+ H2 sections → 2x2 (short) or row-2 (long)
   *
   * Conditions:
   * - 4 or more ## headings
   * - If avg content < 200 chars → 2x2 (first 4 sections)
   * - If avg content >= 200 chars → row-2 (first 2 sections)
   *
   * Result: { "2x2": [...] } or { "row-2": [...] }
   */

  it("should return 2x2 when 4 H2 sections with short content (avg < 200)", () => {
    const markdown = `
## Q1

Sales: 100M
+10% YoY

## Q2

Sales: 120M
+15% YoY

## Q3

Sales: 150M
+20% YoY

## Q4

Sales: 180M
+25% YoY
`;
    const result = tryH2FourPlusLayout(markdown);

    assert.strictEqual(getLayoutType(result), "2x2");
    assert.strictEqual(getSectionCount(result), 4);
  });

  it("should return row-2 when 4 H2 sections with long content (avg >= 200)", () => {
    const longContent = `
This is an extremely long section that contains a tremendous amount of detailed information.
We need to make absolutely sure that this content exceeds the 200 character threshold that
determines whether sections are considered "short" for 2x2 layout purposes. Adding more text.
`;
    const markdown = `
## Introduction
${longContent}

## Background
${longContent}

## Analysis
${longContent}

## Conclusion
${longContent}
`;
    const result = tryH2FourPlusLayout(markdown);

    assert.strictEqual(getLayoutType(result), "row-2");
    assert.strictEqual(getSectionCount(result), 2);
  });

  it("should return null when only 3 H2 sections", () => {
    const markdown = `
## Section 1
Content 1

## Section 2
Content 2

## Section 3
Content 3
`;
    const result = tryH2FourPlusLayout(markdown);

    assert.strictEqual(result, null);
  });
});

// ============================================================================
// Rule 6: tryH2TwoLayout
// ============================================================================
describe("Rule 6: tryH2TwoLayout", () => {
  /**
   * SPEC: 2+ H2 sections → row-2
   *
   * Conditions:
   * - 2 or more ## headings
   *
   * Result: { "row-2": [first 2 sections as line arrays] }
   */

  it("should return row-2 when 2 H2 sections", () => {
    const markdown = `
## Left Section

This is the left content with some details.

- Point 1
- Point 2

## Right Section

This is the right content with more information.

- Detail A
- Detail B
`;
    const result = tryH2TwoLayout(markdown);

    assert.strictEqual(getLayoutType(result), "row-2");
    assert.strictEqual(getSectionCount(result), 2);
  });

  it("should return row-2 using first 2 when 3 H2 sections", () => {
    const markdown = `
## Section One
Content for section one.

## Section Two
Content for section two.

## Section Three (should be ignored)
Content for section three.
`;
    const result = tryH2TwoLayout(markdown);

    assert.strictEqual(getLayoutType(result), "row-2");
    assert.strictEqual(getSectionCount(result), 2);
  });

  it("should return null when only 1 H2 section", () => {
    const markdown = `
## Single Section

This is the only section in this slide.
`;
    const result = tryH2TwoLayout(markdown);

    assert.strictEqual(result, null);
  });

  it("should handle H2 sections with empty content", () => {
    const markdown = `
## Section A

## Section B

`;
    const result = tryH2TwoLayout(markdown);

    assert.strictEqual(getLayoutType(result), "row-2");
  });
});

// ============================================================================
// Integration: layoutPlugin.toBeat (rule priority)
// ============================================================================
describe("Integration: layoutPlugin.toBeat (rule priority)", () => {
  /**
   * SPEC: Rules are evaluated in order, first match wins
   *
   * Priority order:
   * 1. tryCodeBlockLayout
   * 2. tryImageLayout
   * 3. tryH3GridLayout
   * 4. tryH2FourPlusLayout
   * 5. tryH2TwoLayout
   */

  // Helper to get layout type from plugin result
  const getPluginLayoutType = (
    result: ReturnType<typeof layoutPlugin.toBeat>
  ): "row-2" | "2x2" | null => {
    if (!result?.image) return null;
    const markdown = (result.image as { markdown?: Record<string, unknown> }).markdown;
    if (!markdown || typeof markdown !== "object") return null;
    if ("row-2" in markdown) return "row-2";
    if ("2x2" in markdown) return "2x2";
    return null;
  };

  it("should return null for empty markdown", () => {
    const result = layoutPlugin.toBeat!("", { slideIndex: 0, totalSlides: 1 });
    assert.strictEqual(result, null);
  });

  it("should return null for whitespace only", () => {
    const result = layoutPlugin.toBeat!("   \n\n   ", { slideIndex: 0, totalSlides: 1 });
    assert.strictEqual(result, null);
  });

  it("should prioritize code block over H2 sections", () => {
    const markdown = `
## Introduction

This slide explains how to use the GraphAI framework for building workflows.

## Code Example

\`\`\`typescript
const graph = new GraphAI(config);
await graph.run();
\`\`\`
`;
    const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

    // Code block rule matches first
    assert.strictEqual(getPluginLayoutType(result), "row-2");

    // Verify right side contains code
    const layout = (result?.image as { markdown?: { "row-2"?: string[][] } }).markdown;
    const rightSide = layout?.["row-2"]?.[1];
    assert.ok(rightSide?.some((line) => line.includes("```")));
  });

  it("should prioritize image over H2 sections", () => {
    const markdown = `
## Architecture

This diagram shows the overall system architecture and component relationships.

## Diagram

![Architecture](https://example.com/arch.png)
`;
    const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

    // Image rule matches first
    assert.strictEqual(getPluginLayoutType(result), "row-2");

    // Verify right side contains image
    const layout = (result?.image as { markdown?: { "row-2"?: string[][] } }).markdown;
    const rightSide = layout?.["row-2"]?.[1];
    assert.ok(rightSide?.some((line) => line.includes("![")));
  });

  it("should handle H3 sections without H2 interference", () => {
    const markdown = `
### Q1
Sales: 100

### Q2
Sales: 200

### Q3
Sales: 300

### Q4
Sales: 400
`;
    const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

    assert.strictEqual(getPluginLayoutType(result), "2x2");
  });

  it("should handle inline code (not code block)", () => {
    const markdown = `
## Overview

Use the \`graphai\` command to run workflows. The \`nodes\` object defines the structure.

## Details

The \`run()\` method executes the workflow.
`;
    const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

    // Inline code is NOT a code block, so H2 rule applies
    assert.strictEqual(getPluginLayoutType(result), "row-2");
  });

  it("should handle mixed H2 and H3 headings (H2 takes precedence)", () => {
    const markdown = `
## Main Section

Overview content.

### Subsection 1
Detail 1

### Subsection 2
Detail 2

## Another Section

More content here.
`;
    const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

    // 2 H2 sections → row-2
    assert.strictEqual(getPluginLayoutType(result), "row-2");
  });
});

// ============================================================================
// Content Preservation Tests
// ============================================================================
describe("Content Preservation", () => {
  it("should preserve all text content in code block layout", () => {
    const markdown = `
## Feature Overview

GraphAI provides:
- Declarative workflows
- Parallel processing
- LLM integration

\`\`\`typescript
const graph = new GraphAI({});
\`\`\`
`;
    const result = tryCodeBlockLayout(markdown);
    const layout = result?.["row-2"] as string[][] | undefined;

    // Left side should contain feature list
    const leftContent = layout?.[0]?.join("\n") ?? "";
    assert.ok(leftContent.includes("Declarative workflows"));
    assert.ok(leftContent.includes("Parallel processing"));

    // Right side should contain code
    const rightContent = layout?.[1]?.join("\n") ?? "";
    assert.ok(rightContent.includes("new GraphAI"));
  });

  it("should preserve heading hierarchy in H2 sections", () => {
    const markdown = `
## Section A

### Subsection A1

Content under A1

## Section B

### Subsection B1

Content under B1
`;
    const result = tryH2TwoLayout(markdown);
    const layout = result?.["row-2"] as string[][] | undefined;

    // Each section should preserve its subsections
    const leftContent = layout?.[0]?.join("\n") ?? "";
    assert.ok(leftContent.includes("## Section A"));
    assert.ok(leftContent.includes("### Subsection A1"));
  });
});

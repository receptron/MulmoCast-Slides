/**
 * Layout Plugin Unit Tests
 *
 * Tests for auto-detection of layout based on markdown content.
 *
 * ## Test Categories
 *
 * 1. Code Block Detection (row-2)
 *    - Single code block with explanatory text → row-2
 *    - Code block only (no text) → null
 *    - Multiple code blocks → null
 *    - Code block with minimal text (<20 chars) → null
 *
 * 2. Image Detection (row-2)
 *    - Single image with explanatory text → row-2
 *    - Image only (no text) → null
 *    - Multiple images → null
 *    - Image with minimal text (<20 chars) → null
 *
 * 3. H2 Section Detection (row-2 or 2x2)
 *    - 2 H2 sections → row-2
 *    - 3 H2 sections → row-2
 *    - 4+ H2 sections (short content) → 2x2
 *    - 4+ H2 sections (long content) → row-2 (only 2 used)
 *    - 1 H2 section → null
 *
 * 4. H3 Section Detection (2x2)
 *    - 4+ H3 sections (short content) → 2x2
 *    - 4+ H3 sections (long content) → null
 *    - 3 H3 sections → null
 *
 * 5. Edge Cases
 *    - Empty markdown → null
 *    - Only headings (no content) → null
 *    - Mixed H2/H3 headings
 *    - HTML comments in content
 *    - Nested code blocks (edge case)
 *
 * 6. Priority Tests
 *    - Code block takes precedence over H2 sections
 *    - Image takes precedence over H2 sections
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { layoutPlugin } from "../src/convert/markdown-plugins/layout";

// Helper to extract layout type from beat result
const getLayoutType = (
  result: ReturnType<typeof layoutPlugin.toBeat>
): "row-2" | "2x2" | null => {
  if (!result?.image) return null;
  const markdown = (result.image as { markdown?: Record<string, unknown> }).markdown;
  if (!markdown || typeof markdown !== "object") return null;
  if ("row-2" in markdown) return "row-2";
  if ("2x2" in markdown) return "2x2";
  return null;
};

// Helper to get section count from layout
const getSectionCount = (result: ReturnType<typeof layoutPlugin.toBeat>): number => {
  if (!result?.image) return 0;
  const markdown = (result.image as { markdown?: Record<string, unknown[]> }).markdown;
  if (!markdown || typeof markdown !== "object") return 0;
  if ("row-2" in markdown) return (markdown["row-2"] as unknown[]).length;
  if ("2x2" in markdown) return (markdown["2x2"] as unknown[]).length;
  return 0;
};

describe("Layout Plugin", () => {
  // ============================================================================
  // 1. Code Block Detection
  // ============================================================================
  describe("Code Block Detection", () => {
    it("should detect row-2 layout for single code block with explanatory text", () => {
      const markdown = `
## Overview

GraphAI is a declarative workflow engine that enables parallel processing.

\`\`\`typescript
const graph = new GraphAI({
  nodes: { input: { value: "Hello" } }
});
await graph.run();
\`\`\`
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "row-2");
      assert.strictEqual(getSectionCount(result), 2);
    });

    it("should return null for code block only (no explanatory text)", () => {
      const markdown = `
\`\`\`typescript
const x = 1;
console.log(x);
\`\`\`
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(result, null);
    });

    it("should return null for multiple code blocks", () => {
      const markdown = `
## Examples

Here are two code examples.

\`\`\`typescript
const a = 1;
\`\`\`

\`\`\`typescript
const b = 2;
\`\`\`
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // Multiple code blocks don't match single code block pattern
      // Falls through to H2 detection (1 H2 = null)
      assert.strictEqual(result, null);
    });

    it("should return null for code block with minimal text (<20 chars)", () => {
      const markdown = `
## Code

\`\`\`typescript
const x = 1;
\`\`\`
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // "Code" heading only, no meaningful text
      assert.strictEqual(result, null);
    });

    it("should handle code block with exactly 20 chars of text", () => {
      const markdown = `
This is exactly text

\`\`\`typescript
const x = 1;
\`\`\`
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // "This is exactly text" = 20 chars, but we need > 20
      assert.strictEqual(result, null);
    });

    it("should handle code block with 21 chars of text", () => {
      const markdown = `
This is exactly text!

\`\`\`typescript
const x = 1;
\`\`\`
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // "This is exactly text!" = 21 chars, > 20 threshold
      assert.strictEqual(getLayoutType(result), "row-2");
    });
  });

  // ============================================================================
  // 2. Image Detection
  // ============================================================================
  describe("Image Detection", () => {
    it("should detect row-2 layout for single image with explanatory text", () => {
      const markdown = `
## Screenshot

This is a screenshot of the application showing the main dashboard interface.

![Dashboard](https://example.com/dashboard.png)
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "row-2");
      assert.strictEqual(getSectionCount(result), 2);
    });

    it("should return null for image only (no explanatory text)", () => {
      const markdown = `
![Image](https://example.com/image.png)
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(result, null);
    });

    it("should return null for multiple images", () => {
      const markdown = `
## Gallery

Here are some screenshots of our product.

![Image 1](https://example.com/1.png)
![Image 2](https://example.com/2.png)
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // Multiple images don't match single image pattern
      assert.strictEqual(result, null);
    });

    it("should return null for image with minimal text", () => {
      const markdown = `
## Pic

![Image](https://example.com/image.png)
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(result, null);
    });

    it("should handle image with alt text containing special characters", () => {
      const markdown = `
## Architecture Diagram

This diagram shows the system architecture with all components and their connections.

![System [v2.0] - Architecture](https://example.com/arch.png)
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "row-2");
    });
  });

  // ============================================================================
  // 3. H2 Section Detection
  // ============================================================================
  describe("H2 Section Detection", () => {
    it("should detect row-2 layout for 2 H2 sections", () => {
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
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "row-2");
      assert.strictEqual(getSectionCount(result), 2);
    });

    it("should detect row-2 layout for 3 H2 sections (uses first 2)", () => {
      const markdown = `
## Section One

Content for section one.

## Section Two

Content for section two.

## Section Three

Content for section three.
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "row-2");
      assert.strictEqual(getSectionCount(result), 2);
    });

    it("should detect 2x2 layout for 4+ H2 sections with short content", () => {
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
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "2x2");
      assert.strictEqual(getSectionCount(result), 4);
    });

    it("should detect row-2 layout for 4+ H2 sections with long content", () => {
      // Each section needs > 200 chars average to trigger fallback to row-2
      const longContent = `
This is an extremely long section that contains a tremendous amount of detailed information.
We need to make absolutely sure that this content exceeds the 200 character threshold that
determines whether sections are considered "short" for 2x2 layout purposes. Adding more text
here to ensure we definitely cross that boundary with plenty of margin to spare.
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
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // Long content (avg > 200 chars) → falls back to row-2 with 2 sections
      assert.strictEqual(getLayoutType(result), "row-2");
      assert.strictEqual(getSectionCount(result), 2);
    });

    it("should return null for 1 H2 section", () => {
      const markdown = `
## Single Section

This is the only section in this slide.

- Point 1
- Point 2
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(result, null);
    });

    it("should handle H2 sections with empty content", () => {
      const markdown = `
## Section A

## Section B

`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // 2 H2 sections but empty content
      assert.strictEqual(getLayoutType(result), "row-2");
    });
  });

  // ============================================================================
  // 4. H3 Section Detection
  // ============================================================================
  describe("H3 Section Detection", () => {
    it("should detect 2x2 layout for 4+ H3 sections with short content", () => {
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
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "2x2");
      assert.strictEqual(getSectionCount(result), 4);
    });

    it("should return null for 3 H3 sections (less than 4)", () => {
      const markdown = `
### Item 1
Value: 100

### Item 2
Value: 200

### Item 3
Value: 300
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(result, null);
    });

    it("should handle 5+ H3 sections (uses first 4)", () => {
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
Content E
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "2x2");
      assert.strictEqual(getSectionCount(result), 4);
    });

    it("should return null for 4+ H3 sections with long content", () => {
      // Each section needs > 200 chars average to NOT trigger 2x2
      const longContent = `
This is an extremely long section that contains a tremendous amount of detailed information.
We need to make absolutely sure that this content exceeds the 200 character threshold that
determines whether sections are considered "short" for 2x2 layout purposes. Adding more text
here to ensure we definitely cross that boundary with plenty of margin to spare.
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
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // Long content → doesn't match 2x2, no fallback for H3
      assert.strictEqual(result, null);
    });
  });

  // ============================================================================
  // 5. Edge Cases
  // ============================================================================
  describe("Edge Cases", () => {
    it("should return null for empty markdown", () => {
      const result = layoutPlugin.toBeat!("", { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(result, null);
    });

    it("should return null for whitespace only", () => {
      const result = layoutPlugin.toBeat!("   \n\n   \t\t\n", {
        slideIndex: 0,
        totalSlides: 1,
      });

      assert.strictEqual(result, null);
    });

    it("should return null for only H1 heading", () => {
      const markdown = `# Title Only`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(result, null);
    });

    it("should handle markdown with HTML comments", () => {
      const markdown = `
## Section A

<!-- This is a comment -->
Content for section A with some explanation.

## Section B

<!-- Another comment -->
Content for section B with details.
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "row-2");
    });

    it("should handle markdown with inline code (not block)", () => {
      const markdown = `
## Overview

Use the \`graphai\` command to run workflows. The \`nodes\` object defines the structure.

## Details

The \`run()\` method executes the workflow.
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // Inline code is not a code block
      assert.strictEqual(getLayoutType(result), "row-2");
    });

    it("should handle mixed H2 and H3 headings", () => {
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
      assert.strictEqual(getLayoutType(result), "row-2");
    });

    it("should handle code block with language specifier", () => {
      const markdown = `
## Python Example

Here is how to use the library in Python for data processing tasks.

\`\`\`python
import graphai
graph = graphai.Graph()
graph.run()
\`\`\`
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "row-2");
    });

    it("should handle code block without language specifier", () => {
      const markdown = `
## Code Sample

This is a generic code sample showing the basic structure.

\`\`\`
const x = 1;
console.log(x);
\`\`\`
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      assert.strictEqual(getLayoutType(result), "row-2");
    });
  });

  // ============================================================================
  // 6. Priority Tests
  // ============================================================================
  describe("Priority Tests", () => {
    it("should detect code block layout even with H2 sections present", () => {
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

      // Code block + text takes precedence
      assert.strictEqual(getLayoutType(result), "row-2");

      // Verify it's the code block layout (right side should have code)
      const markdown2 = (result?.image as { markdown?: { "row-2"?: string[][] } }).markdown;
      const rightSide = markdown2?.["row-2"]?.[1];
      assert.ok(rightSide?.some((line) => line.includes("```")));
    });

    it("should detect image layout even with H2 sections present", () => {
      const markdown = `
## Architecture

This diagram shows the overall system architecture and component relationships.

## Diagram

![Architecture](https://example.com/arch.png)
`;
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });

      // Image + text takes precedence
      assert.strictEqual(getLayoutType(result), "row-2");

      // Verify it's the image layout (right side should have image)
      const markdown2 = (result?.image as { markdown?: { "row-2"?: string[][] } }).markdown;
      const rightSide = markdown2?.["row-2"]?.[1];
      assert.ok(rightSide?.some((line) => line.includes("![")));
    });
  });

  // ============================================================================
  // 7. Content Preservation Tests
  // ============================================================================
  describe("Content Preservation", () => {
    it("should preserve all text content in row-2 code block layout", () => {
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
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });
      const layout = (result?.image as { markdown?: { "row-2"?: string[][] } }).markdown?.[
        "row-2"
      ];

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
      const result = layoutPlugin.toBeat!(markdown, { slideIndex: 0, totalSlides: 1 });
      const layout = (result?.image as { markdown?: { "row-2"?: string[][] } }).markdown?.[
        "row-2"
      ];

      // Each section should preserve its subsections
      const leftContent = layout?.[0]?.join("\n") ?? "";
      assert.ok(leftContent.includes("## Section A"));
      assert.ok(leftContent.includes("### Subsection A1"));
    });
  });
});

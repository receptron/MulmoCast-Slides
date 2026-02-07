/**
 * Unit tests for markdownToMulmoScript pure transform
 *
 * Tests the browser-safe markdown → MulmoScript conversion.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { markdownToMulmoScript, slideToBeat, slidesToMulmoScript } from "../src/convert/markdown-transform.js";

describe("markdownToMulmoScript", () => {
  it("converts simple markdown with horizontal-rule separator", () => {
    const content = `# Slide 1
Content 1
<!-- Speaker note 1 -->

---

# Slide 2
Content 2
<!-- Speaker note 2 -->`;

    const result = markdownToMulmoScript(content);

    assert.strictEqual(result.lang, "en");
    assert.strictEqual(result.beats.length, 2);
    assert.strictEqual(result.$mulmocast.version, "1.1");
    assert.strictEqual(result.beats[0].text, "Speaker note 1");
    assert.strictEqual(result.beats[1].text, "Speaker note 2");
  });

  it("defaults to English when lang is not specified", () => {
    const result = markdownToMulmoScript("# Hello");
    assert.strictEqual(result.lang, "en");
  });

  it("respects lang option", () => {
    const result = markdownToMulmoScript("# Hello", { lang: "ja" });
    assert.strictEqual(result.lang, "ja");
  });

  it("respects separator option", () => {
    const content = `# Slide 1
Content 1

# Slide 2
Content 2`;

    const result = markdownToMulmoScript(content, { separator: "heading" });
    assert.strictEqual(result.beats.length, 2);
  });

  it("applies mermaid plugin when enabled", () => {
    const content = `# Title
<!-- Explanation -->

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

Some explanatory text that is long enough to trigger row-2 layout.`;

    const result = markdownToMulmoScript(content, { mermaid: true });
    assert.strictEqual(result.beats.length, 1);

    const image = result.beats[0].image as Record<string, unknown>;
    assert.strictEqual(image.type, "markdown");
  });

  it("applies directive plugin when enabled", () => {
    const content = `<!-- _class: lead -->
# Title Slide
<!-- This is a speaker note -->`;

    const result = markdownToMulmoScript(content, { directive: true });
    assert.strictEqual(result.beats.length, 1);
    assert.strictEqual(result.beats[0].text, "This is a speaker note");
  });

  it("applies style option to beats", () => {
    const content = "# Hello World";
    const result = markdownToMulmoScript(content, { style: "corporate-blue" });

    const image = result.beats[0].image as Record<string, unknown>;
    assert.strictEqual(image.style, "corporate-blue");
  });

  it("handles empty slides (filters them out)", () => {
    const content = `# Slide 1

---



---

# Slide 2`;

    const result = markdownToMulmoScript(content);
    assert.strictEqual(result.beats.length, 2);
  });

  it("extracts notes and excludes TODO/FIXME comments", () => {
    const content = `# Slide
<!-- TODO: fix this later -->
<!-- Actual speaker note -->`;

    const result = markdownToMulmoScript(content);
    assert.strictEqual(result.beats[0].text, "Actual speaker note");
  });
});

describe("slideToBeat", () => {
  it("creates markdown beat from slide content", () => {
    const result = slideToBeat("# Hello\nWorld", "speaker note", null);
    assert.strictEqual(result.text, "speaker note");

    const image = result.image as Record<string, unknown>;
    assert.strictEqual(image.type, "markdown");
  });

  it("uses plugin-generated beat when available", () => {
    const pluginBeat = {
      text: "plugin text",
      image: { type: "markdown" as const, markdown: ["test"] },
    };
    const result = slideToBeat("# Hello", "fallback note", pluginBeat);

    assert.strictEqual(result.text, "plugin text");
    assert.deepStrictEqual(result.image, pluginBeat.image);
  });

  it("falls back to note text when plugin beat has no text", () => {
    const pluginBeat = {
      image: { type: "markdown" as const, markdown: ["test"] },
    };
    const result = slideToBeat("# Hello", "fallback note", pluginBeat);

    assert.strictEqual(result.text, "fallback note");
  });

  it("applies style to markdown beat", () => {
    const result = slideToBeat("# Hello", "note", null, "corporate-blue");

    const image = result.image as Record<string, unknown>;
    assert.strictEqual(image.style, "corporate-blue");
  });
});

describe("slidesToMulmoScript", () => {
  it("creates MulmoScript structure", () => {
    const slides = [
      { markdown: "# Slide 1", note: "Note 1", beat: null },
      { markdown: "# Slide 2", note: "Note 2", beat: null },
    ];

    const result = slidesToMulmoScript(slides, "ja");

    assert.strictEqual(result.$mulmocast.version, "1.1");
    assert.strictEqual(result.$mulmocast.credit, "closing");
    assert.strictEqual(result.lang, "ja");
    assert.strictEqual(result.beats.length, 2);
  });
});

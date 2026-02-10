import test from "node:test";
import assert from "node:assert";
import {
  buildNarrationPrompt,
  parseNarrationResponse,
} from "../src/utils/narration-generator.js";
import type { DocumentAnalysis } from "../src/utils/document-analysis.js";

const makeAnalysis = (slideCount: number): DocumentAnalysis => ({
  title: "Test Document",
  authors: "Author A",
  sections: [{ name: "Intro", pages: [0], summary: "Introduction" }],
  figures: [],
  slides: Array.from({ length: slideCount }, (_, i) => ({
    title: `Slide ${i}`,
    section: "Intro",
    sourcePages: [i],
    narrationHint: `Hint for slide ${i}`,
  })),
});

// --- buildNarrationPrompt ---

test("buildNarrationPrompt: includes document title", () => {
  const prompt = buildNarrationPrompt({
    documentAnalysis: makeAnalysis(2),
    extractedTexts: ["Text 0", "Text 1"],
    lang: "en",
  });
  assert.ok(prompt.includes("Test Document"));
});

test("buildNarrationPrompt: includes author", () => {
  const prompt = buildNarrationPrompt({
    documentAnalysis: makeAnalysis(1),
    extractedTexts: [],
    lang: "en",
  });
  assert.ok(prompt.includes("Author A"));
});

test("buildNarrationPrompt: includes language", () => {
  const prompt = buildNarrationPrompt({
    documentAnalysis: makeAnalysis(1),
    extractedTexts: [],
    lang: "ja",
  });
  assert.ok(prompt.includes("Japanese"));
});

test("buildNarrationPrompt: includes slide specs", () => {
  const prompt = buildNarrationPrompt({
    documentAnalysis: makeAnalysis(3),
    extractedTexts: ["Page 0", "Page 1", "Page 2"],
    lang: "en",
  });
  assert.ok(prompt.includes("Slide 0"));
  assert.ok(prompt.includes("Slide 1"));
  assert.ok(prompt.includes("Slide 2"));
  assert.ok(prompt.includes("Hint for slide 0"));
});

test("buildNarrationPrompt: includes slide count", () => {
  const prompt = buildNarrationPrompt({
    documentAnalysis: makeAnalysis(5),
    extractedTexts: [],
    lang: "en",
  });
  assert.ok(prompt.includes("ALL 5 slides"));
});

test("buildNarrationPrompt: includes figureRef when present", () => {
  const analysis = makeAnalysis(1);
  analysis.slides[0].figureRef = "Figure 1";
  const prompt = buildNarrationPrompt({
    documentAnalysis: analysis,
    extractedTexts: [],
    lang: "en",
  });
  assert.ok(prompt.includes("Figure 1"));
});

test("buildNarrationPrompt: truncates long source text", () => {
  const longText = "y".repeat(5000);
  const prompt = buildNarrationPrompt({
    documentAnalysis: makeAnalysis(1),
    extractedTexts: [longText],
    lang: "en",
  });
  assert.ok(prompt.includes("..."));
  assert.ok(!prompt.includes("y".repeat(5000)));
});

// --- parseNarrationResponse ---

test("parseNarrationResponse: parses valid response", () => {
  const content = JSON.stringify({
    narrations: [
      { index: 0, text: "First slide narration" },
      { index: 1, text: "Second slide narration" },
    ],
  });

  const result = parseNarrationResponse(content, 2);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].text, "First slide narration");
  assert.strictEqual(result[1].text, "Second slide narration");
});

test("parseNarrationResponse: handles markdown-wrapped JSON", () => {
  const content = '```json\n{"narrations":[{"index":0,"text":"Hello"}]}\n```';

  const result = parseNarrationResponse(content, 1);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].text, "Hello");
});

test("parseNarrationResponse: fills missing indices with empty text", () => {
  const content = JSON.stringify({
    narrations: [{ index: 0, text: "Only first" }],
  });

  const result = parseNarrationResponse(content, 3);
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].text, "Only first");
  assert.strictEqual(result[1].text, "");
  assert.strictEqual(result[2].text, "");
});

test("parseNarrationResponse: handles empty narrations array", () => {
  const content = JSON.stringify({ narrations: [] });

  const result = parseNarrationResponse(content, 2);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].text, "");
  assert.strictEqual(result[1].text, "");
});

test("parseNarrationResponse: throws on invalid JSON", () => {
  assert.throws(() => parseNarrationResponse("not json", 1));
});

test("parseNarrationResponse: handles out-of-order indices", () => {
  const content = JSON.stringify({
    narrations: [
      { index: 2, text: "Third" },
      { index: 0, text: "First" },
      { index: 1, text: "Second" },
    ],
  });

  const result = parseNarrationResponse(content, 3);
  assert.strictEqual(result[0].text, "First");
  assert.strictEqual(result[1].text, "Second");
  assert.strictEqual(result[2].text, "Third");
});

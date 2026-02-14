import test from "node:test";
import assert from "node:assert";
import { buildBeatContent, buildScriptMetaContent, buildScriptContent } from "@mulmocast/script-utils";
import type { ExtendedMulmoViewerData, ExtendedMulmoViewerBeat } from "@mulmocast/extended-types";

const makeBeat = (overrides: Partial<ExtendedMulmoViewerBeat> = {}): ExtendedMulmoViewerBeat => ({
  text: "Default beat text",
  ...overrides,
});

const makeViewerData = (
  overrides: Partial<ExtendedMulmoViewerData> = {},
): ExtendedMulmoViewerData => ({
  beats: [makeBeat()],
  ...overrides,
});

// --- buildBeatContent ---

test("buildBeatContent: formats beat with all meta fields", () => {
  const beat = makeBeat({
    text: "Introduction to AI",
    meta: {
      tags: ["ai", "intro"],
      keywords: ["machine learning"],
      expectedQuestions: ["What is AI?", "How does ML work?"],
      context: "Opening section",
    },
  });

  const result = buildBeatContent(beat, 0);
  assert.ok(result.includes("[0] Introduction to AI"));
  assert.ok(result.includes("Tags: ai, intro"));
  assert.ok(result.includes("Keywords: machine learning"));
  assert.ok(result.includes("Can answer: What is AI?; How does ML work?"));
  assert.ok(result.includes("Context: Opening section"));
});

test("buildBeatContent: formats beat without meta", () => {
  const beat = makeBeat({ text: "Simple slide" });
  const result = buildBeatContent(beat, 3);
  assert.strictEqual(result, "[3] Simple slide");
});

test("buildBeatContent: handles empty text", () => {
  const beat = makeBeat({ text: undefined });
  const result = buildBeatContent(beat, 0);
  // Preprocessor returns empty string for beats with no text
  assert.strictEqual(result, "");
});

test("buildBeatContent: handles meta with no optional fields", () => {
  const beat = makeBeat({ text: "Beat", meta: {} });
  const result = buildBeatContent(beat, 1);
  assert.strictEqual(result, "[1] Beat");
});

// --- buildScriptMetaContent ---

test("buildScriptMetaContent: formats all fields", () => {
  const data = makeViewerData({
    scriptMeta: {
      background: "AI research overview",
      audience: "Developers",
      goals: ["Understand basics", "Apply concepts"],
      prerequisites: ["Programming knowledge"],
      keywords: ["AI", "ML"],
      faq: [
        { question: "What is AI?", answer: "Artificial Intelligence" },
        { question: "Why ML?", answer: "Data-driven decisions" },
      ],
      author: "Test Author",
    },
  });

  const result = buildScriptMetaContent(data);
  assert.ok(result.includes("Background: AI research overview"));
  assert.ok(result.includes("Target audience: Developers"));
  assert.ok(result.includes("Goals: Understand basics; Apply concepts"));
  assert.ok(result.includes("Prerequisites: Programming knowledge"));
  assert.ok(result.includes("Keywords: AI, ML"));
  assert.ok(result.includes("Q: What is AI?"));
  assert.ok(result.includes("A: Artificial Intelligence"));
  assert.ok(result.includes("Author: Test Author"));
});

test("buildScriptMetaContent: handles minimal scriptMeta", () => {
  const data = makeViewerData({ scriptMeta: {} });
  const result = buildScriptMetaContent(data);
  assert.strictEqual(result, "");
});

test("buildScriptMetaContent: returns empty when no scriptMeta", () => {
  const data = makeViewerData({});
  const result = buildScriptMetaContent(data);
  assert.strictEqual(result, "");
});

// --- buildScriptContent ---

test("buildScriptContent: full happy path", () => {
  const data = makeViewerData({
    title: "AI Workshop",
    lang: "en",
    scriptMeta: {
      background: "Overview of AI",
      audience: "Engineers",
      faq: [{ question: "What is AI?", answer: "Intelligence by machines" }],
    },
    beats: [
      makeBeat({
        text: "Intro slide",
        meta: { section: "Introduction", tags: ["intro"], keywords: ["ai"] },
      }),
      makeBeat({
        text: "Details slide",
        meta: { section: "Details", tags: ["deep-dive"] },
      }),
      makeBeat({
        text: "Summary slide",
        meta: { section: "Introduction" },
      }),
    ],
  });

  const result = buildScriptContent(data);
  assert.ok(result.includes("# Script: AI Workshop"));
  assert.ok(result.includes("Language: en"));
  assert.ok(result.includes("## About this content"));
  assert.ok(result.includes("Background: Overview of AI"));
  assert.ok(result.includes("## Section: Introduction"));
  assert.ok(result.includes("[0] Intro slide"));
  assert.ok(result.includes("[2] Summary slide"));
  assert.ok(result.includes("## Section: Details"));
  assert.ok(result.includes("[1] Details slide"));
});

test("buildScriptContent: no scriptMeta", () => {
  const data = makeViewerData({
    title: "Simple Deck",
    lang: "ja",
    beats: [makeBeat({ text: "Only slide" })],
  });

  const result = buildScriptContent(data);
  assert.ok(result.includes("# Script: Simple Deck"));
  assert.ok(result.includes("Language: ja"));
  assert.ok(!result.includes("## About this content"));
  assert.ok(result.includes("[0] Only slide"));
});

test("buildScriptContent: empty beats array", () => {
  const data = makeViewerData({ title: "Empty", beats: [] });
  const result = buildScriptContent(data);
  assert.ok(result.includes("# Script: Empty"));
  // No section headers when no beats
  assert.ok(!result.includes("## Section:"));
});

test("buildScriptContent: beats without meta use 'main' section", () => {
  const data = makeViewerData({
    beats: [makeBeat({ text: "A" }), makeBeat({ text: "B" })],
  });

  const result = buildScriptContent(data);
  assert.ok(result.includes("## Section: main"));
  assert.ok(result.includes("[0] A"));
  assert.ok(result.includes("[1] B"));
});

test("buildScriptContent: section grouping preserves beat indices", () => {
  const data = makeViewerData({
    beats: [
      makeBeat({ text: "A", meta: { section: "S1" } }),
      makeBeat({ text: "B", meta: { section: "S2" } }),
      makeBeat({ text: "C", meta: { section: "S1" } }),
      makeBeat({ text: "D", meta: { section: "S2" } }),
    ],
  });

  const result = buildScriptContent(data);
  const s1Start = result.indexOf("## Section: S1");
  const s2Start = result.indexOf("## Section: S2");
  assert.ok(s1Start < s2Start, "S1 should appear before S2");

  // S1 should contain beats 0 and 2
  const s1Block = result.slice(s1Start, s2Start);
  assert.ok(s1Block.includes("[0] A"));
  assert.ok(s1Block.includes("[2] C"));

  // S2 should contain beats 1 and 3
  const s2Block = result.slice(s2Start);
  assert.ok(s2Block.includes("[1] B"));
  assert.ok(s2Block.includes("[3] D"));
});

test("buildScriptContent: undefined title shows as 'undefined'", () => {
  const data = makeViewerData({ beats: [] });
  const result = buildScriptContent(data);
  assert.ok(result.includes("# Script:"));
});

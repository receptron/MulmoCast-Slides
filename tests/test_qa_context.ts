import test from "node:test";
import assert from "node:assert";
import { buildBeatContent, buildScriptMetaContent, buildContext } from "../src/vue/qa-context.js";
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
      notes: "Keep it simple",
    },
  });

  const result = buildBeatContent(beat, 0);
  assert.ok(result.includes("[0] Introduction to AI"));
  assert.ok(result.includes("Tags: ai, intro"));
  assert.ok(result.includes("Keywords: machine learning"));
  assert.ok(result.includes("Can answer: What is AI?"));
  assert.ok(result.includes("Can answer: How does ML work?"));
  assert.ok(result.includes("Context: Opening section"));
  assert.ok(result.includes("Notes: Keep it simple"));
});

test("buildBeatContent: formats beat without meta", () => {
  const beat = makeBeat({ text: "Simple slide" });
  const result = buildBeatContent(beat, 3);
  assert.strictEqual(result, "[3] Simple slide");
});

test("buildBeatContent: handles empty text", () => {
  const beat = makeBeat({ text: undefined });
  const result = buildBeatContent(beat, 0);
  assert.ok(result.startsWith("[0] "));
});

test("buildBeatContent: handles meta with no optional fields", () => {
  const beat = makeBeat({ text: "Beat", meta: {} });
  const result = buildBeatContent(beat, 1);
  assert.strictEqual(result, "[1] Beat");
});

// --- buildScriptMetaContent ---

test("buildScriptMetaContent: formats all fields", () => {
  const result = buildScriptMetaContent({
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
  });

  assert.ok(result.includes("## About this content"));
  assert.ok(result.includes("Background: AI research overview"));
  assert.ok(result.includes("Target audience: Developers"));
  assert.ok(result.includes("Goals: Understand basics, Apply concepts"));
  assert.ok(result.includes("Prerequisites: Programming knowledge"));
  assert.ok(result.includes("Keywords: AI, ML"));
  assert.ok(result.includes("Q: What is AI?"));
  assert.ok(result.includes("A: Artificial Intelligence"));
  assert.ok(result.includes("Author: Test Author"));
});

test("buildScriptMetaContent: handles minimal scriptMeta", () => {
  const result = buildScriptMetaContent({});
  assert.strictEqual(result, "## About this content");
});

// --- buildContext ---

test("buildContext: full happy path", () => {
  const data = makeViewerData({
    title: "AI Workshop",
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

  const result = buildContext(data);
  assert.ok(result.includes("# Presentation: AI Workshop"));
  assert.ok(result.includes("## About this content"));
  assert.ok(result.includes("Background: Overview of AI"));
  assert.ok(result.includes("## Section: Introduction"));
  assert.ok(result.includes("[0] Intro slide"));
  assert.ok(result.includes("[2] Summary slide"));
  assert.ok(result.includes("## Section: Details"));
  assert.ok(result.includes("[1] Details slide"));
});

test("buildContext: no scriptMeta", () => {
  const data = makeViewerData({
    title: "Simple Deck",
    beats: [makeBeat({ text: "Only slide" })],
  });

  const result = buildContext(data);
  assert.ok(result.includes("# Presentation: Simple Deck"));
  assert.ok(!result.includes("## About this content"));
  assert.ok(result.includes("[0] Only slide"));
});

test("buildContext: empty beats array", () => {
  const data = makeViewerData({ title: "Empty", beats: [] });
  const result = buildContext(data);
  assert.ok(result.includes("# Presentation: Empty"));
  // No section headers when no beats
  assert.ok(!result.includes("## Section:"));
});

test("buildContext: beats without meta use (no section) group", () => {
  const data = makeViewerData({
    beats: [makeBeat({ text: "A" }), makeBeat({ text: "B" })],
  });

  const result = buildContext(data);
  assert.ok(result.includes("## Section: (no section)"));
  assert.ok(result.includes("[0] A"));
  assert.ok(result.includes("[1] B"));
});

test("buildContext: section grouping preserves beat indices", () => {
  const data = makeViewerData({
    beats: [
      makeBeat({ text: "A", meta: { section: "S1" } }),
      makeBeat({ text: "B", meta: { section: "S2" } }),
      makeBeat({ text: "C", meta: { section: "S1" } }),
      makeBeat({ text: "D", meta: { section: "S2" } }),
    ],
  });

  const result = buildContext(data);
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

test("buildContext: uses 'Untitled Presentation' when no title", () => {
  const data = makeViewerData({ beats: [] });
  const result = buildContext(data);
  assert.ok(result.includes("# Presentation: Untitled Presentation"));
});

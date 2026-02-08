import test from "node:test";
import assert from "node:assert";
import {
  buildDocumentAnalysisPrompt,
  parseDocumentAnalysis,
} from "../src/utils/document-analysis.js";

// --- buildDocumentAnalysisPrompt ---

test("buildDocumentAnalysisPrompt: includes page count", () => {
  const prompt = buildDocumentAnalysisPrompt({
    pageCount: 10,
    extractedTexts: [],
    lang: "en",
  });
  assert.ok(prompt.includes("10 pages"));
});

test("buildDocumentAnalysisPrompt: includes language name", () => {
  const prompt = buildDocumentAnalysisPrompt({
    pageCount: 5,
    extractedTexts: [],
    lang: "ja",
  });
  assert.ok(prompt.includes("Japanese"));
});

test("buildDocumentAnalysisPrompt: includes extracted text per page", () => {
  const prompt = buildDocumentAnalysisPrompt({
    pageCount: 2,
    extractedTexts: ["Page zero text", "Page one text"],
    lang: "en",
  });
  assert.ok(prompt.includes("Page zero text"));
  assert.ok(prompt.includes("Page one text"));
  assert.ok(prompt.includes("Page 0"));
  assert.ok(prompt.includes("Page 1"));
});

test("buildDocumentAnalysisPrompt: handles empty text pages", () => {
  const prompt = buildDocumentAnalysisPrompt({
    pageCount: 2,
    extractedTexts: ["", "Some text"],
    lang: "en",
  });
  assert.ok(prompt.includes("(no text)"));
  assert.ok(prompt.includes("Some text"));
});

test("buildDocumentAnalysisPrompt: truncates long text", () => {
  const longText = "x".repeat(3000);
  const prompt = buildDocumentAnalysisPrompt({
    pageCount: 1,
    extractedTexts: [longText],
    lang: "en",
  });
  assert.ok(prompt.includes("..."));
  assert.ok(!prompt.includes("x".repeat(3000)));
});

// --- parseDocumentAnalysis ---

test("parseDocumentAnalysis: parses valid JSON", () => {
  const json = JSON.stringify({
    title: "Test Paper",
    authors: "Author A",
    sections: [{ name: "Intro", pages: [0, 1], summary: "Introduction section" }],
    figures: [
      { page: 2, type: "figure", label: "Figure 1", description: "A chart", importance: "high" },
    ],
    slides: [
      {
        title: "Opening",
        section: "Intro",
        sourcePages: [0],
        imagePage: 0,
        narrationHint: "Introduce the topic",
      },
    ],
  });

  const result = parseDocumentAnalysis(json);
  assert.strictEqual(result.title, "Test Paper");
  assert.strictEqual(result.authors, "Author A");
  assert.strictEqual(result.sections.length, 1);
  assert.strictEqual(result.figures.length, 1);
  assert.strictEqual(result.slides.length, 1);
  assert.strictEqual(result.slides[0].title, "Opening");
  assert.strictEqual(result.slides[0].imagePage, 0);
});

test("parseDocumentAnalysis: handles JSON wrapped in markdown code block", () => {
  const content = '```json\n{"title":"Test","sections":[],"figures":[],"slides":[{"title":"S1","section":"A","sourcePages":[0],"narrationHint":"hint"}]}\n```';

  const result = parseDocumentAnalysis(content);
  assert.strictEqual(result.title, "Test");
  assert.strictEqual(result.slides.length, 1);
});

test("parseDocumentAnalysis: provides defaults for missing fields", () => {
  const json = JSON.stringify({
    slides: [{ sourcePages: [0] }],
  });

  const result = parseDocumentAnalysis(json);
  assert.strictEqual(result.title, "Untitled");
  assert.strictEqual(result.authors, undefined);
  assert.strictEqual(result.sections.length, 0);
  assert.strictEqual(result.figures.length, 0);
  assert.strictEqual(result.slides[0].title, "");
  assert.strictEqual(result.slides[0].narrationHint, "");
});

test("parseDocumentAnalysis: throws on empty slides", () => {
  const json = JSON.stringify({
    title: "Test",
    sections: [],
    figures: [],
    slides: [],
  });

  assert.throws(() => parseDocumentAnalysis(json), /no slides/);
});

test("parseDocumentAnalysis: throws on invalid JSON", () => {
  assert.throws(() => parseDocumentAnalysis("not json at all"));
});

test("parseDocumentAnalysis: parses figure bbox", () => {
  const json = JSON.stringify({
    figures: [
      {
        page: 2,
        type: "figure",
        label: "Figure 1",
        description: "A chart",
        importance: "high",
        bbox: { x: 10, y: 30, width: 80, height: 40 },
      },
    ],
    slides: [{ title: "S", section: "A", sourcePages: [0], narrationHint: "hint" }],
  });

  const result = parseDocumentAnalysis(json);
  assert.ok(result.figures[0].bbox);
  assert.strictEqual(result.figures[0].bbox!.x, 10);
  assert.strictEqual(result.figures[0].bbox!.y, 30);
  assert.strictEqual(result.figures[0].bbox!.width, 80);
  assert.strictEqual(result.figures[0].bbox!.height, 40);
});

test("parseDocumentAnalysis: handles figure without bbox", () => {
  const json = JSON.stringify({
    figures: [
      { page: 1, type: "table", description: "A table", importance: "medium" },
    ],
    slides: [{ title: "S", section: "A", sourcePages: [0], narrationHint: "hint" }],
  });

  const result = parseDocumentAnalysis(json);
  assert.strictEqual(result.figures[0].bbox, undefined);
});

test("parseDocumentAnalysis: handles partial bbox (missing fields)", () => {
  const json = JSON.stringify({
    figures: [
      {
        page: 1,
        type: "figure",
        description: "Incomplete bbox",
        importance: "low",
        bbox: { x: 10, y: 20 },
      },
    ],
    slides: [{ title: "S", section: "A", sourcePages: [0], narrationHint: "hint" }],
  });

  const result = parseDocumentAnalysis(json);
  assert.strictEqual(result.figures[0].bbox, undefined);
});

test("parseDocumentAnalysis: handles optional figureRef", () => {
  const json = JSON.stringify({
    slides: [
      {
        title: "Fig slide",
        section: "A",
        sourcePages: [1],
        figureRef: "Figure 1",
        narrationHint: "Discuss the figure",
      },
      {
        title: "Text slide",
        section: "A",
        sourcePages: [2],
        narrationHint: "Discuss text",
      },
    ],
  });

  const result = parseDocumentAnalysis(json);
  assert.strictEqual(result.slides[0].figureRef, "Figure 1");
  assert.strictEqual(result.slides[1].figureRef, undefined);
});

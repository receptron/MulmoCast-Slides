import test from "node:test";
import assert from "node:assert";
import { buildMetadataPrompt, parseMetadataResponse } from "../src/utils/llm-metadata.js";

test("buildMetadataPrompt: includes title and language", () => {
  const prompt = buildMetadataPrompt({
    beats: [{ index: 0, text: "Hello" }],
    lang: "ja",
    title: "My Presentation",
  });

  assert.ok(prompt.includes("My Presentation"));
  assert.ok(prompt.includes("Japanese"));
});

test("buildMetadataPrompt: uses Untitled when no title", () => {
  const prompt = buildMetadataPrompt({
    beats: [{ index: 0, text: "Hello" }],
    lang: "en",
  });

  assert.ok(prompt.includes("Untitled Presentation"));
});

test("buildMetadataPrompt: includes slide content", () => {
  const prompt = buildMetadataPrompt({
    beats: [
      { index: 0, markdown: ["# Title", "- Point 1"] },
      { index: 1, text: "Existing narration" },
    ],
    lang: "en",
  });

  assert.ok(prompt.includes("# Title"));
  assert.ok(prompt.includes("- Point 1"));
  assert.ok(prompt.includes("[Existing narration]: Existing narration"));
});

test("buildMetadataPrompt: includes extracted text", () => {
  const prompt = buildMetadataPrompt({
    beats: [{ index: 0, extractedText: "Raw PDF text here" }],
    lang: "en",
  });

  assert.ok(prompt.includes("[Extracted text]: Raw PDF text here"));
});

test("buildMetadataPrompt: includes source content when provided", () => {
  const prompt = buildMetadataPrompt({
    beats: [{ index: 0, text: "Hello" }],
    lang: "en",
    sourceContent: "# My Document\nSome content",
  });

  assert.ok(prompt.includes("Original source document"));
  assert.ok(prompt.includes("# My Document"));
});

test("buildMetadataPrompt: requests text for beats without narration", () => {
  const prompt = buildMetadataPrompt({
    beats: [
      { index: 0, text: "" },
      { index: 1, text: "Has text" },
      { index: 2 },
    ],
    lang: "en",
  });

  assert.ok(prompt.includes("Generate narration"));
  assert.ok(prompt.includes("0, 2"));
});

test("buildMetadataPrompt: skips text generation when all beats have narration", () => {
  const prompt = buildMetadataPrompt({
    beats: [
      { index: 0, text: "Has text" },
      { index: 1, text: "Also has text" },
    ],
    lang: "en",
  });

  assert.ok(prompt.includes("All slides already have narration"));
  assert.ok(prompt.includes("Do NOT generate text"));
});

test("buildMetadataPrompt: supports all languages", () => {
  const languages = [
    { lang: "en" as const, expected: "English" },
    { lang: "ja" as const, expected: "Japanese" },
    { lang: "fr" as const, expected: "French" },
    { lang: "de" as const, expected: "German" },
  ];

  languages.forEach(({ lang, expected }) => {
    const prompt = buildMetadataPrompt({
      beats: [{ index: 0 }],
      lang,
    });
    assert.ok(prompt.includes(expected), `Expected ${expected} for lang ${lang}`);
  });
});

test("parseMetadataResponse: parses valid JSON response", () => {
  const response = JSON.stringify({
    scriptMeta: {
      background: "A presentation about testing",
      audience: "developers",
      goals: ["Learn testing"],
      keywords: ["test", "unit"],
    },
    beatResults: [
      {
        index: 0,
        text: "Generated narration",
        meta: {
          section: "introduction",
          tags: ["intro"],
          keywords: ["testing"],
          context: "This is the intro",
          expectedQuestions: ["What is testing?"],
        },
      },
      {
        index: 1,
        meta: {
          section: "main-content",
          tags: ["content"],
          keywords: ["unit-test"],
          context: "Main section",
        },
      },
    ],
  });

  const result = parseMetadataResponse(response, 2);

  assert.strictEqual(result.scriptMeta.background, "A presentation about testing");
  assert.strictEqual(result.scriptMeta.audience, "developers");
  assert.deepStrictEqual(result.scriptMeta.keywords, ["test", "unit"]);

  assert.strictEqual(result.beatResults.length, 2);
  assert.strictEqual(result.beatResults[0].text, "Generated narration");
  assert.strictEqual(result.beatResults[0].meta.section, "introduction");
  assert.strictEqual(result.beatResults[1].text, undefined);
  assert.strictEqual(result.beatResults[1].meta.section, "main-content");
});

test("parseMetadataResponse: fills missing beats with empty meta", () => {
  const response = JSON.stringify({
    scriptMeta: {},
    beatResults: [
      { index: 0, meta: { section: "intro" } },
      // index 1 missing
      { index: 2, meta: { section: "end" } },
    ],
  });

  const result = parseMetadataResponse(response, 3);

  assert.strictEqual(result.beatResults.length, 3);
  assert.strictEqual(result.beatResults[0].meta.section, "intro");
  assert.deepStrictEqual(result.beatResults[1].meta, {});
  assert.strictEqual(result.beatResults[2].meta.section, "end");
});

test("parseMetadataResponse: handles empty scriptMeta", () => {
  const response = JSON.stringify({
    beatResults: [{ index: 0, meta: {} }],
  });

  const result = parseMetadataResponse(response, 1);

  assert.deepStrictEqual(result.scriptMeta, {});
  assert.strictEqual(result.beatResults.length, 1);
});

test("parseMetadataResponse: throws on invalid JSON", () => {
  assert.throws(
    () => parseMetadataResponse("{ not valid json", 1),
    (err: unknown) => err instanceof SyntaxError
  );
});

test("parseMetadataResponse: handles empty beatResults", () => {
  const response = JSON.stringify({
    scriptMeta: { background: "test" },
    beatResults: [],
  });

  const result = parseMetadataResponse(response, 3);

  assert.strictEqual(result.beatResults.length, 3);
  result.beatResults.forEach((br) => {
    assert.deepStrictEqual(br.meta, {});
    assert.strictEqual(br.text, undefined);
  });
});

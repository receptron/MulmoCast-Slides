import test from "node:test";
import assert from "node:assert";
import { getSlideSchemaForPrompt } from "../src/utils/slide-schema.js";

test("getSlideSchemaForPrompt: returns non-empty string", () => {
  const result = getSlideSchemaForPrompt();
  assert.ok(result.length > 0, "Schema should not be empty");
});

test("getSlideSchemaForPrompt: contains layout types", () => {
  const result = getSlideSchemaForPrompt();
  const expectedLayouts = [
    "title",
    "columns",
    "comparison",
    "grid",
    "bigQuote",
    "stats",
    "timeline",
    "split",
    "matrix",
    "table",
    "funnel",
  ];
  expectedLayouts.forEach((layout) => {
    assert.ok(result.includes(`"${layout}"`), `Schema should contain layout "${layout}"`);
  });
});

test("getSlideSchemaForPrompt: contains content block types", () => {
  const result = getSlideSchemaForPrompt();
  const expectedBlocks = ["text", "bullets", "code", "callout", "metric", "divider"];
  expectedBlocks.forEach((block) => {
    assert.ok(result.includes(`"${block}"`), `Schema should contain block type "${block}"`);
  });
});

test("getSlideSchemaForPrompt: caches result", () => {
  const first = getSlideSchemaForPrompt();
  const second = getSlideSchemaForPrompt();
  assert.strictEqual(first, second, "Consecutive calls should return the same cached reference");
});

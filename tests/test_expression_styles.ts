import test from "node:test";
import assert from "node:assert";
import {
  expressionStyles,
  EXPRESSION_NAMES,
  type ExpressionStyle,
} from "../src/utils/expression-styles.js";
import { generateBasename } from "../src/actions/url-to-script.js";

// Expression styles structure tests
test("expressionStyles: all styles have required fields", () => {
  EXPRESSION_NAMES.forEach((name) => {
    const style: ExpressionStyle = expressionStyles[name];
    assert.ok(style.name, `${name} should have a name`);
    assert.ok(style.description, `${name} should have a description`);
    assert.ok(style.systemPrompt, `${name} should have a systemPrompt`);
  });
});

test("expressionStyles: systemPrompt is non-empty for all styles", () => {
  EXPRESSION_NAMES.forEach((name) => {
    const style = expressionStyles[name];
    assert.ok(style.systemPrompt.length > 100, `${name} systemPrompt should be substantial`);
  });
});

test("EXPRESSION_NAMES: contains expected styles", () => {
  assert.ok(EXPRESSION_NAMES.includes("author"));
  assert.ok(EXPRESSION_NAMES.includes("news"));
  assert.ok(EXPRESSION_NAMES.includes("overview"));
});

test("EXPRESSION_NAMES: matches expressionStyles keys", () => {
  assert.deepStrictEqual(EXPRESSION_NAMES, Object.keys(expressionStyles));
});

test("expressionStyles: name field matches key", () => {
  EXPRESSION_NAMES.forEach((name) => {
    assert.strictEqual(expressionStyles[name].name, name);
  });
});

test("expressionStyles: systemPrompt contains common beat instructions", () => {
  EXPRESSION_NAMES.forEach((name) => {
    const prompt = expressionStyles[name].systemPrompt;
    assert.ok(prompt.includes("MulmoScript"), `${name} should mention MulmoScript format`);
    assert.ok(prompt.includes("beats"), `${name} should mention beats`);
    assert.ok(prompt.includes("meta"), `${name} should mention meta`);
  });
});

// Basename generation tests
test("generateBasename: creates date-title format", () => {
  const result = generateBasename("My Article Title", "20260217");
  assert.strictEqual(result, "20260217-My-Article-Title");
});

test("generateBasename: sanitizes special characters", () => {
  const result = generateBasename("Hello World! (2024)", "20260217");
  assert.strictEqual(result, "20260217-Hello-World-2024");
});

test("generateBasename: truncates long titles to 30 chars", () => {
  const longTitle = "This is a very long article title that exceeds the maximum length";
  const result = generateBasename(longTitle, "20260217");
  const titlePart = result.replace("20260217-", "");
  assert.ok(titlePart.length <= 30, `Title part should be at most 30 chars, got ${titlePart.length}`);
});

test("generateBasename: handles null title", () => {
  const result = generateBasename(null, "20260217");
  assert.strictEqual(result, "20260217-article");
});

test("generateBasename: handles empty string title", () => {
  const result = generateBasename("", "20260217");
  assert.strictEqual(result, "20260217-article");
});

test("generateBasename: handles Japanese title", () => {
  const result = generateBasename("日本語のタイトル", "20260217");
  assert.ok(result.startsWith("20260217-"));
});

test("generateBasename: handles title with multiple spaces", () => {
  const result = generateBasename("Title   With   Spaces", "20260217");
  assert.strictEqual(result, "20260217-Title-With-Spaces");
});

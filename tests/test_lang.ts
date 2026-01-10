import test from "node:test";
import assert from "node:assert";
import {
  isValidLang,
  resolveLang,
  detectLang,
  SUPPORTED_LANGS,
  DEFAULT_LANG,
} from "../src/utils/lang";

// isValidLang tests
test("isValidLang: should return true for supported languages", () => {
  assert.strictEqual(isValidLang("en"), true);
  assert.strictEqual(isValidLang("ja"), true);
  assert.strictEqual(isValidLang("fr"), true);
  assert.strictEqual(isValidLang("de"), true);
});

test("isValidLang: should return false for unsupported languages", () => {
  assert.strictEqual(isValidLang("es"), false);
  assert.strictEqual(isValidLang("zh"), false);
  assert.strictEqual(isValidLang(""), false);
  assert.strictEqual(isValidLang("english"), false);
  assert.strictEqual(isValidLang("EN"), false); // case sensitive
});

// SUPPORTED_LANGS tests
test("SUPPORTED_LANGS: should contain expected languages", () => {
  assert.ok(SUPPORTED_LANGS.includes("en"));
  assert.ok(SUPPORTED_LANGS.includes("ja"));
  assert.ok(SUPPORTED_LANGS.includes("fr"));
  assert.ok(SUPPORTED_LANGS.includes("de"));
  assert.strictEqual(SUPPORTED_LANGS.length, 4);
});

// DEFAULT_LANG tests
test("DEFAULT_LANG: should be English", () => {
  assert.strictEqual(DEFAULT_LANG, "en");
});

// resolveLang tests
test("resolveLang: should return CLI lang when provided", () => {
  assert.strictEqual(resolveLang("ja"), "ja");
  assert.strictEqual(resolveLang("fr"), "fr");
  assert.strictEqual(resolveLang("de"), "de");
});

test("resolveLang: should return default when CLI lang is invalid", () => {
  // Save original env
  const originalEnv = process.env.MULMO_LANG;
  delete process.env.MULMO_LANG;

  assert.strictEqual(resolveLang("invalid"), DEFAULT_LANG);
  assert.strictEqual(resolveLang(""), DEFAULT_LANG);

  // Restore env
  if (originalEnv !== undefined) {
    process.env.MULMO_LANG = originalEnv;
  }
});

test("resolveLang: should return default when no lang provided", () => {
  // Save original env
  const originalEnv = process.env.MULMO_LANG;
  delete process.env.MULMO_LANG;

  assert.strictEqual(resolveLang(undefined), DEFAULT_LANG);
  assert.strictEqual(resolveLang(), DEFAULT_LANG);

  // Restore env
  if (originalEnv !== undefined) {
    process.env.MULMO_LANG = originalEnv;
  }
});

test("resolveLang: should use env variable when CLI not provided", () => {
  // Save original env
  const originalEnv = process.env.MULMO_LANG;

  process.env.MULMO_LANG = "ja";
  assert.strictEqual(resolveLang(undefined), "ja");

  process.env.MULMO_LANG = "fr";
  assert.strictEqual(resolveLang(), "fr");

  // Restore env
  if (originalEnv !== undefined) {
    process.env.MULMO_LANG = originalEnv;
  } else {
    delete process.env.MULMO_LANG;
  }
});

test("resolveLang: CLI should take priority over env variable", () => {
  // Save original env
  const originalEnv = process.env.MULMO_LANG;

  process.env.MULMO_LANG = "ja";
  assert.strictEqual(resolveLang("de"), "de");
  assert.strictEqual(resolveLang("fr"), "fr");

  // Restore env
  if (originalEnv !== undefined) {
    process.env.MULMO_LANG = originalEnv;
  } else {
    delete process.env.MULMO_LANG;
  }
});

// detectLang tests
test("detectLang: should detect Japanese text", () => {
  const japaneseTexts = [
    "皆さん、こんにちは。本日は「おもちかえり.com」のご紹介をいたします。",
    "このサービスは、飲食店が初期費用や利用料を一切負担せずにテイクアウトを活用できます。",
  ];
  assert.strictEqual(detectLang(japaneseTexts), "ja");
});

test("detectLang: should detect English text", () => {
  const englishTexts = [
    "Hi, my name is Satoshi Nakajima.",
    "Today I'd like to introduce GraphAI, an open-source project I've been working on.",
    "GraphAI is about a very simple but important idea.",
  ];
  assert.strictEqual(detectLang(englishTexts), "en");
});

test("detectLang: should detect French text", () => {
  const frenchTexts = [
    "Bonjour, je m'appelle Claude. Comment allez-vous aujourd'hui?",
    "Je suis très heureux de vous rencontrer. Nous allons parler de technologie.",
  ];
  assert.strictEqual(detectLang(frenchTexts), "fr");
});

test("detectLang: should return undefined for short text", () => {
  assert.strictEqual(detectLang("Hi"), undefined);
  assert.strictEqual(detectLang([]), undefined);
});

test("detectLang: should work with single string", () => {
  const longJapanese = "皆さん、こんにちは。本日は新しいサービスのご紹介をいたします。";
  assert.strictEqual(detectLang(longJapanese), "ja");
});

test("resolveLang: should auto-detect from texts when no lang specified", () => {
  // Save original env
  const originalEnv = process.env.MULMO_LANG;
  delete process.env.MULMO_LANG;

  const japaneseTexts = [
    "皆さん、こんにちは。本日はおもちかえりのご紹介をいたします。",
    "このサービスは飲食店が利用できます。",
  ];
  assert.strictEqual(resolveLang(undefined, japaneseTexts), "ja");

  // Restore env
  if (originalEnv !== undefined) {
    process.env.MULMO_LANG = originalEnv;
  }
});

test("resolveLang: CLI lang should take priority over auto-detection", () => {
  // Save original env
  const originalEnv = process.env.MULMO_LANG;
  delete process.env.MULMO_LANG;

  const japaneseTexts = ["皆さん、こんにちは。"];
  assert.strictEqual(resolveLang("en", japaneseTexts), "en");

  // Restore env
  if (originalEnv !== undefined) {
    process.env.MULMO_LANG = originalEnv;
  }
});

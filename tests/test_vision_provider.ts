import test from "node:test";
import assert from "node:assert";
import { resolveVisionProvider } from "../src/utils/vision-provider.js";

test("resolveVisionProvider: returns gemini when explicitly requested", () => {
  assert.strictEqual(resolveVisionProvider("gemini"), "gemini");
});

test("resolveVisionProvider: returns openai when explicitly requested", () => {
  assert.strictEqual(resolveVisionProvider("openai"), "openai");
});

test("resolveVisionProvider: throws for unknown provider", () => {
  assert.throws(() => resolveVisionProvider("claude"), /Unknown provider/);
});

test("resolveVisionProvider: auto-detects gemini from env", () => {
  const original = process.env.GEMINI_API_KEY;
  const originalOpenai = process.env.OPENAI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.OPENAI_API_KEY;
    assert.strictEqual(resolveVisionProvider(), "gemini");
  } finally {
    if (original !== undefined) {
      process.env.GEMINI_API_KEY = original;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    if (originalOpenai !== undefined) {
      process.env.OPENAI_API_KEY = originalOpenai;
    }
  }
});

test("resolveVisionProvider: auto-detects openai from env", () => {
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalOpenai = process.env.OPENAI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    assert.strictEqual(resolveVisionProvider(), "openai");
  } finally {
    if (originalGemini !== undefined) {
      process.env.GEMINI_API_KEY = originalGemini;
    }
    if (originalOpenai !== undefined) {
      process.env.OPENAI_API_KEY = originalOpenai;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }
});

test("resolveVisionProvider: gemini takes priority over openai", () => {
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalOpenai = process.env.OPENAI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.OPENAI_API_KEY = "openai-key";
    assert.strictEqual(resolveVisionProvider(), "gemini");
  } finally {
    if (originalGemini !== undefined) {
      process.env.GEMINI_API_KEY = originalGemini;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    if (originalOpenai !== undefined) {
      process.env.OPENAI_API_KEY = originalOpenai;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  }
});

test("resolveVisionProvider: throws when no keys available", () => {
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalOpenai = process.env.OPENAI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    assert.throws(() => resolveVisionProvider(), /No Vision API key found/);
  } finally {
    if (originalGemini !== undefined) {
      process.env.GEMINI_API_KEY = originalGemini;
    }
    if (originalOpenai !== undefined) {
      process.env.OPENAI_API_KEY = originalOpenai;
    }
  }
});

import test from "node:test";
import assert from "node:assert";
import { scaffoldExtendedScript } from "../src/actions/extend-scaffold.js";
import { extendedScriptSchema } from "@mulmocast/extended-types";

const makeMulmoScript = (overrides: Record<string, unknown> = {}) => ({
  $mulmocast: { version: "1.1" },
  speechParams: { speakers: {} },
  imageParams: { provider: "openai", images: {} },
  beats: [
    { text: "Slide one" },
    { text: "Slide two" },
    { text: "Slide three" },
  ],
  ...overrides,
});

test("scaffold: adds beat IDs when missing", () => {
  const input = makeMulmoScript();
  const result = scaffoldExtendedScript(input, null);

  assert.strictEqual(result.beats[0].id, "beat-1");
  assert.strictEqual(result.beats[1].id, "beat-2");
  assert.strictEqual(result.beats[2].id, "beat-3");
});

test("scaffold: preserves existing beat IDs", () => {
  const input = makeMulmoScript({
    beats: [
      { id: "intro", text: "Intro" },
      { text: "No ID" },
      { id: "outro", text: "Outro" },
    ],
  });
  const result = scaffoldExtendedScript(input, null);

  assert.strictEqual(result.beats[0].id, "intro");
  assert.strictEqual(result.beats[1].id, "beat-2");
  assert.strictEqual(result.beats[2].id, "outro");
});

test("scaffold: adds empty meta to each beat", () => {
  const input = makeMulmoScript();
  const result = scaffoldExtendedScript(input, null);

  result.beats.forEach((beat) => {
    assert.ok(beat.meta !== undefined);
    assert.strictEqual(typeof beat.meta, "object");
  });
});

test("scaffold: adds notes from extractedTexts", () => {
  const input = makeMulmoScript();
  const texts = ["Text from slide 1", "Text from slide 2", "Text from slide 3"];
  const result = scaffoldExtendedScript(input, texts);

  assert.strictEqual((result.beats[0].meta as Record<string, unknown>).notes, "Text from slide 1");
  assert.strictEqual((result.beats[1].meta as Record<string, unknown>).notes, "Text from slide 2");
  assert.strictEqual((result.beats[2].meta as Record<string, unknown>).notes, "Text from slide 3");
});

test("scaffold: handles extractedTexts shorter than beats", () => {
  const input = makeMulmoScript();
  const texts = ["Only first"];
  const result = scaffoldExtendedScript(input, texts);

  assert.strictEqual((result.beats[0].meta as Record<string, unknown>).notes, "Only first");
  assert.strictEqual((result.beats[1].meta as Record<string, unknown>).notes, undefined);
  assert.strictEqual((result.beats[2].meta as Record<string, unknown>).notes, undefined);
});

test("scaffold: skips empty strings in extractedTexts", () => {
  const input = makeMulmoScript();
  const texts = ["", "Has text", ""];
  const result = scaffoldExtendedScript(input, texts);

  assert.strictEqual((result.beats[0].meta as Record<string, unknown>).notes, undefined);
  assert.strictEqual((result.beats[1].meta as Record<string, unknown>).notes, "Has text");
  assert.strictEqual((result.beats[2].meta as Record<string, unknown>).notes, undefined);
});

test("scaffold: adds scriptMeta and outputProfiles", () => {
  const input = makeMulmoScript();
  const result = scaffoldExtendedScript(input, null);

  assert.deepStrictEqual(result.scriptMeta, {});
  assert.deepStrictEqual(result.outputProfiles, {});
});

test("scaffold: preserves existing scriptMeta", () => {
  const input = makeMulmoScript({
    scriptMeta: { audience: "developers", keywords: ["test"] },
  });
  const result = scaffoldExtendedScript(input, null);

  assert.deepStrictEqual(result.scriptMeta, { audience: "developers", keywords: ["test"] });
});

test("scaffold: preserves existing outputProfiles", () => {
  const input = makeMulmoScript({
    outputProfiles: { short: { name: "Short version" } },
  });
  const result = scaffoldExtendedScript(input, null);

  assert.deepStrictEqual(result.outputProfiles, { short: { name: "Short version" } });
});

test("scaffold: preserves existing beat meta fields", () => {
  const input = makeMulmoScript({
    beats: [
      { text: "Slide one", meta: { tags: ["intro"], section: "opening" } },
      { text: "Slide two" },
    ],
  });
  const result = scaffoldExtendedScript(input, null);

  const meta0 = result.beats[0].meta as Record<string, unknown>;
  assert.deepStrictEqual(meta0.tags, ["intro"]);
  assert.strictEqual(meta0.section, "opening");
});

test("scaffold: preserves all original MulmoScript fields", () => {
  const input = makeMulmoScript({ title: "My Presentation", lang: "ja" });
  const result = scaffoldExtendedScript(input, null);

  assert.strictEqual((result as Record<string, unknown>).title, "My Presentation");
  assert.strictEqual((result as Record<string, unknown>).lang, "ja");
});

test("scaffold: output passes ExtendedScript schema validation", () => {
  const input = makeMulmoScript();
  const result = scaffoldExtendedScript(input, null);

  const validation = extendedScriptSchema.safeParse(result);
  assert.ok(validation.success, `Validation failed: ${JSON.stringify(validation.error?.issues)}`);
});

test("scaffold: output with notes passes ExtendedScript schema validation", () => {
  const input = makeMulmoScript();
  const texts = ["Note 1", "Note 2", "Note 3"];
  const result = scaffoldExtendedScript(input, texts);

  const validation = extendedScriptSchema.safeParse(result);
  assert.ok(validation.success, `Validation failed: ${JSON.stringify(validation.error?.issues)}`);
});

test("scaffold: handles empty beats array", () => {
  const input = makeMulmoScript({ beats: [] });
  const result = scaffoldExtendedScript(input, null);

  assert.strictEqual(result.beats.length, 0);
  assert.deepStrictEqual(result.scriptMeta, {});
  assert.deepStrictEqual(result.outputProfiles, {});
});

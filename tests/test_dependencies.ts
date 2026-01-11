import test from "node:test";
import assert from "node:assert";
import { CONVERTER_DEPENDENCIES } from "../src/utils/dependencies";

// CONVERTER_DEPENDENCIES tests
test("CONVERTER_DEPENDENCIES: pptx requires libreoffice, imagemagick, ghostscript", () => {
  const deps = CONVERTER_DEPENDENCIES["pptx"];
  assert.ok(Array.isArray(deps));
  assert.ok(deps.includes("libreoffice"));
  assert.ok(deps.includes("imagemagick"));
  assert.ok(deps.includes("ghostscript"));
});

test("CONVERTER_DEPENDENCIES: pdf requires imagemagick, ghostscript", () => {
  const deps = CONVERTER_DEPENDENCIES["pdf"];
  assert.ok(Array.isArray(deps));
  assert.ok(deps.includes("imagemagick"));
  assert.ok(deps.includes("ghostscript"));
  assert.ok(!deps.includes("libreoffice"));
});

test("CONVERTER_DEPENDENCIES: marp has no external dependencies", () => {
  const deps = CONVERTER_DEPENDENCIES["marp"];
  assert.ok(Array.isArray(deps));
  assert.strictEqual(deps.length, 0);
});

test("CONVERTER_DEPENDENCIES: keynote has no external dependencies (checked separately)", () => {
  const deps = CONVERTER_DEPENDENCIES["keynote"];
  assert.ok(Array.isArray(deps));
  assert.strictEqual(deps.length, 0);
});

test("CONVERTER_DEPENDENCIES: movie requires ffmpeg", () => {
  const deps = CONVERTER_DEPENDENCIES["movie"];
  assert.ok(Array.isArray(deps));
  assert.ok(deps.includes("ffmpeg"));
});

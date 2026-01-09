import test from "node:test";
import assert from "node:assert";
import { detectFileType, getBasename, getMulmoScriptPath } from "../src/actions/common";

// detectFileType tests
test("detectFileType: should detect PPTX files", () => {
  assert.strictEqual(detectFileType("presentation.pptx"), "pptx");
  assert.strictEqual(detectFileType("/path/to/file.pptx"), "pptx");
  assert.strictEqual(detectFileType("file.PPTX"), "pptx");
});

test("detectFileType: should detect Marp markdown files", () => {
  assert.strictEqual(detectFileType("slides.md"), "marp");
  assert.strictEqual(detectFileType("/path/to/slides.md"), "marp");
  assert.strictEqual(detectFileType("file.MD"), "marp");
});

test("detectFileType: should detect Keynote files", () => {
  assert.strictEqual(detectFileType("presentation.key"), "keynote");
  assert.strictEqual(detectFileType("/path/to/file.key"), "keynote");
  assert.strictEqual(detectFileType("file.KEY"), "keynote");
});

test("detectFileType: should detect PDF files", () => {
  assert.strictEqual(detectFileType("document.pdf"), "pdf");
  assert.strictEqual(detectFileType("/path/to/file.pdf"), "pdf");
  assert.strictEqual(detectFileType("file.PDF"), "pdf");
});

test("detectFileType: should throw for unsupported file types", () => {
  assert.throws(() => detectFileType("file.txt"), /Unsupported file type/);
  assert.throws(() => detectFileType("file.docx"), /Unsupported file type/);
  assert.throws(() => detectFileType("file"), /Unsupported file type/);
});

// getBasename tests
test("getBasename: should extract basename without extension", () => {
  assert.strictEqual(getBasename("presentation.pptx"), "presentation");
  assert.strictEqual(getBasename("slides.md"), "slides");
  assert.strictEqual(getBasename("document.pdf"), "document");
});

test("getBasename: should handle paths with directories", () => {
  assert.strictEqual(getBasename("/path/to/presentation.pptx"), "presentation");
  assert.strictEqual(getBasename("./slides/deck.md"), "deck");
  assert.strictEqual(getBasename("samples/test.pdf"), "test");
});

test("getBasename: should handle filenames with multiple dots", () => {
  assert.strictEqual(getBasename("my.presentation.v2.pptx"), "my.presentation.v2");
  assert.strictEqual(getBasename("slide.deck.final.md"), "slide.deck.final");
});

// getMulmoScriptPath tests
test("getMulmoScriptPath: should return correct path", () => {
  assert.strictEqual(getMulmoScriptPath("presentation"), "scripts/presentation/mulmo_script.json");
  assert.strictEqual(getMulmoScriptPath("my-slides"), "scripts/my-slides/mulmo_script.json");
});

test("getMulmoScriptPath: should handle various basenames", () => {
  assert.strictEqual(getMulmoScriptPath("test"), "scripts/test/mulmo_script.json");
  assert.strictEqual(getMulmoScriptPath("my.presentation.v2"), "scripts/my.presentation.v2/mulmo_script.json");
});

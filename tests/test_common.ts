import test from "node:test";
import assert from "node:assert";
import * as path from "node:path";
import {
  detectFileType,
  getBasename,
  getMulmoScriptPath,
  getPackageRoot,
  getKeynoteScriptPath,
} from "../src/actions/common";

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

test("detectFileType: should detect video files", () => {
  assert.strictEqual(detectFileType("video.mp4"), "movie");
  assert.strictEqual(detectFileType("/path/to/file.mov"), "movie");
  assert.strictEqual(detectFileType("file.mkv"), "movie");
  assert.strictEqual(detectFileType("file.webm"), "movie");
  assert.strictEqual(detectFileType("file.avi"), "movie");
  assert.strictEqual(detectFileType("file.m4v"), "movie");
  assert.strictEqual(detectFileType("file.MP4"), "movie");
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

// getPackageRoot tests
test("getPackageRoot: should return a valid directory path", () => {
  const root = getPackageRoot();
  assert.ok(typeof root === "string");
  assert.ok(root.length > 0);
  // Should be an absolute path
  assert.ok(path.isAbsolute(root));
});

// getKeynoteScriptPath tests
test("getKeynoteScriptPath: should return path to AppleScript", () => {
  const scriptPath = getKeynoteScriptPath();
  assert.ok(scriptPath.endsWith("tools/keynote/extract.scpt") || scriptPath.endsWith("tools\\keynote\\extract.scpt"));
  assert.ok(path.isAbsolute(scriptPath));
});

test("getKeynoteScriptPath: should be under package root", () => {
  const root = getPackageRoot();
  const scriptPath = getKeynoteScriptPath();
  assert.ok(scriptPath.startsWith(root));
});

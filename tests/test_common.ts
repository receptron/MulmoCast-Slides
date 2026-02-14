import test from "node:test";
import assert from "node:assert";
import * as path from "node:path";
import {
  detectFileType,
  getBasename,
  sanitizeBasename,
  getMulmoScriptFilename,
  getMulmoScriptPath,
  getPackageRoot,
  getKeynoteScriptPath,
} from "../src/actions/common.js";

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

// Regression: filenames with spaces broke preview URLs (#97)
test("getBasename: should sanitize spaces in filenames", () => {
  assert.strictEqual(getBasename("My Presentation.pptx"), "My-Presentation");
  assert.strictEqual(getBasename("/path/to/My Video File.mp4"), "My-Video-File");
  assert.strictEqual(getBasename("file   with   multiple   spaces.md"), "file-with-multiple-spaces");
});

test("getBasename: should sanitize special characters", () => {
  assert.strictEqual(getBasename("file (copy).pptx"), "file-copy");
  assert.strictEqual(getBasename("video [2024].mp4"), "video-2024");
  assert.strictEqual(getBasename("slide#1.md"), "slide1");
});

// sanitizeBasename tests
test("sanitizeBasename: should replace spaces with hyphens", () => {
  assert.strictEqual(sanitizeBasename("hello world"), "hello-world");
  assert.strictEqual(sanitizeBasename("a  b  c"), "a-b-c");
});

test("sanitizeBasename: should remove URL-unsafe characters", () => {
  assert.strictEqual(sanitizeBasename("file(1)"), "file1");
  assert.strictEqual(sanitizeBasename("test[v2]"), "testv2");
  assert.strictEqual(sanitizeBasename("a#b$c"), "abc");
});

test("sanitizeBasename: should collapse consecutive hyphens", () => {
  assert.strictEqual(sanitizeBasename("a - b - c"), "a-b-c");
  assert.strictEqual(sanitizeBasename("hello   ---   world"), "hello-world");
});

test("sanitizeBasename: should preserve dots, underscores, and hyphens", () => {
  assert.strictEqual(sanitizeBasename("my.file-name_v2"), "my.file-name_v2");
  assert.strictEqual(sanitizeBasename("slide_deck-final.v3"), "slide_deck-final.v3");
});

test("sanitizeBasename: should trim leading and trailing hyphens", () => {
  assert.strictEqual(sanitizeBasename(" hello "), "hello");
  assert.strictEqual(sanitizeBasename("(foo)"), "foo");
  assert.strictEqual(sanitizeBasename("--test--"), "test");
});

test("sanitizeBasename: should handle empty string", () => {
  assert.strictEqual(sanitizeBasename(""), "");
});

test("sanitizeBasename: should handle already clean names", () => {
  assert.strictEqual(sanitizeBasename("presentation"), "presentation");
  assert.strictEqual(sanitizeBasename("my-slides"), "my-slides");
});

// getMulmoScriptFilename tests
test("getMulmoScriptFilename: should return basename.json", () => {
  assert.strictEqual(getMulmoScriptFilename("presentation"), "presentation.json");
  assert.strictEqual(getMulmoScriptFilename("my-slides"), "my-slides.json");
});

// getMulmoScriptPath tests
test("getMulmoScriptPath: should return correct path", () => {
  assert.strictEqual(getMulmoScriptPath("presentation"), path.join("scripts", "presentation", "presentation.json"));
  assert.strictEqual(getMulmoScriptPath("my-slides"), path.join("scripts", "my-slides", "my-slides.json"));
});

test("getMulmoScriptPath: should handle various basenames", () => {
  assert.strictEqual(getMulmoScriptPath("test"), path.join("scripts", "test", "test.json"));
  assert.strictEqual(getMulmoScriptPath("my.presentation.v2"), path.join("scripts", "my.presentation.v2", "my.presentation.v2.json"));
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

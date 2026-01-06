import test from "node:test";
import assert from "node:assert";
import {
  parseSlides,
  extractNotesFromSlide,
  extractNotesFromSlides,
  extractMarkdownFromSlide,
  extractMarkdownFromSlides,
} from "../tools/marp/extract";

test("parseSlides: should split content by slide separator", () => {
  const content = `# Slide 1

---

# Slide 2

---

# Slide 3`;

  const slides = parseSlides(content);

  assert.strictEqual(slides.length, 3);
  assert.ok(slides[0].includes("# Slide 1"));
  assert.ok(slides[1].includes("# Slide 2"));
  assert.ok(slides[2].includes("# Slide 3"));
});

test("parseSlides: should remove YAML front matter", () => {
  const content = `---
marp: true
theme: default
---

# First Slide

---

# Second Slide`;

  const slides = parseSlides(content);

  assert.strictEqual(slides.length, 2);
  assert.ok(slides[0].includes("# First Slide"));
  assert.ok(slides[1].includes("# Second Slide"));
});

test("parseSlides: should handle content without front matter", () => {
  const content = `# Only Slide

Some content here`;

  const slides = parseSlides(content);

  assert.strictEqual(slides.length, 1);
  assert.ok(slides[0].includes("# Only Slide"));
});

test("extractNotesFromSlide: should extract single comment", () => {
  const slideContent = `# Title

Some content

<!-- This is the speaker note -->`;

  const notes = extractNotesFromSlide(slideContent);

  assert.strictEqual(notes, "This is the speaker note");
});

test("extractNotesFromSlide: should extract multiple comments", () => {
  const slideContent = `# Title

<!-- First note -->

Some content

<!-- Second note -->`;

  const notes = extractNotesFromSlide(slideContent);

  assert.strictEqual(notes, "First note\nSecond note");
});

test("extractNotesFromSlide: should return empty string when no comments", () => {
  const slideContent = `# Title

Some content without notes`;

  const notes = extractNotesFromSlide(slideContent);

  assert.strictEqual(notes, "");
});

test("extractNotesFromSlide: should handle multiline comments", () => {
  const slideContent = `# Title

<!--
This is a multiline
speaker note
with several lines
-->`;

  const notes = extractNotesFromSlide(slideContent);

  assert.ok(notes.includes("This is a multiline"));
  assert.ok(notes.includes("speaker note"));
  assert.ok(notes.includes("with several lines"));
});

test("extractNotesFromSlides: should extract notes from all slides", () => {
  const slides = [
    "# Slide 1\n<!-- Note 1 -->",
    "# Slide 2\n<!-- Note 2 -->",
    "# Slide 3\nNo notes here",
  ];

  const notes = extractNotesFromSlides(slides);

  assert.strictEqual(notes.length, 3);
  assert.strictEqual(notes[0], "Note 1");
  assert.strictEqual(notes[1], "Note 2");
  assert.strictEqual(notes[2], "");
});

test("extractMarkdownFromSlide: should remove HTML comments", () => {
  const slideContent = `# Title

Some content

<!-- This is a speaker note -->

More content`;

  const lines = extractMarkdownFromSlide(slideContent);

  assert.ok(lines.includes("# Title"));
  assert.ok(lines.includes("Some content"));
  assert.ok(lines.includes("More content"));
  assert.ok(!lines.some((line) => line.includes("speaker note")));
});

test("extractMarkdownFromSlide: should filter empty lines and trim", () => {
  const slideContent = `# Title

   Some content with spaces

`;

  const lines = extractMarkdownFromSlide(slideContent);

  assert.strictEqual(lines.length, 2);
  assert.strictEqual(lines[0], "# Title");
  assert.strictEqual(lines[1], "Some content with spaces");
});

test("extractMarkdownFromSlides: should process all slides", () => {
  const slides = [
    "# Slide 1\n- Item 1\n- Item 2",
    "# Slide 2\n## Subtitle\nContent",
  ];

  const markdowns = extractMarkdownFromSlides(slides);

  assert.strictEqual(markdowns.length, 2);
  assert.deepStrictEqual(markdowns[0], ["# Slide 1", "- Item 1", "- Item 2"]);
  assert.deepStrictEqual(markdowns[1], ["# Slide 2", "## Subtitle", "Content"]);
});

test("integration: full markdown parsing flow", () => {
  const content = `---
marp: true
theme: default
---

# First Slide

Welcome to the presentation.

<!-- Introduction notes -->

---

# Second Slide

## Key Points

- Point 1
- Point 2

<!-- Discussion notes -->`;

  const slides = parseSlides(content);
  const notes = extractNotesFromSlides(slides);
  const markdowns = extractMarkdownFromSlides(slides);

  assert.strictEqual(slides.length, 2);

  assert.strictEqual(notes[0], "Introduction notes");
  assert.strictEqual(notes[1], "Discussion notes");

  assert.ok(markdowns[0].includes("# First Slide"));
  assert.ok(markdowns[0].includes("Welcome to the presentation."));
  assert.ok(!markdowns[0].some((line) => line.includes("Introduction notes")));

  assert.ok(markdowns[1].includes("# Second Slide"));
  assert.ok(markdowns[1].includes("- Point 1"));
  assert.ok(markdowns[1].includes("- Point 2"));
});

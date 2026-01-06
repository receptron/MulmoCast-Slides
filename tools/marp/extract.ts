#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Type Definitions
interface MulmoScript {
  $mulmocast: {
    version: string;
    credit: string;
  };
  beats: Beat[];
}

interface Beat {
  text: string;
  image: ImagePath | ImageMarkdown;
}

interface ImagePath {
  type: "image";
  source: {
    kind: "path";
    path: string;
  };
}

interface ImageMarkdown {
  type: "markdown";
  markdown: string[];
}

// Parse command-line arguments
function parseArguments(): string {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error("Error: No input file specified");
    console.error("Usage: yarn marp <path-to-marp-file.md>");
    process.exit(1);
  }

  const absolutePath = path.resolve(inputPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found: ${absolutePath}`);
    process.exit(1);
  }

  if (!absolutePath.endsWith(".md")) {
    console.error("Error: Input file must be a .md (Markdown) file");
    process.exit(1);
  }

  return absolutePath;
}

// Setup output directories
function setupOutputDirectories(): void {
  const outputFolder = path.join(process.cwd(), "output");
  const outputImagesFolder = path.join(outputFolder, "images");

  // Create directories if they don't exist
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  if (!fs.existsSync(outputImagesFolder)) {
    fs.mkdirSync(outputImagesFolder, { recursive: true });
  }

  // Clean existing PNG files
  const files = fs.readdirSync(outputImagesFolder);
  for (const file of files) {
    if (file.endsWith(".png")) {
      fs.unlinkSync(path.join(outputImagesFolder, file));
    }
  }
}

// Parse markdown content into slides (removes YAML front matter)
export function parseSlides(content: string): string[] {
  // Split by slide separator
  let slides = content.split(/\n---\n/);

  // Remove YAML front matter (first section if it starts with ---)
  if (slides.length > 0 && slides[0].trim().startsWith("---")) {
    slides.shift();
  }

  return slides;
}

// Extract speaker notes from parsed slides
export function extractNotesFromSlides(slides: string[]): string[] {
  const notes: string[] = [];

  for (const slide of slides) {
    const slideNotes = extractNotesFromSlide(slide);
    notes.push(slideNotes);
  }

  return notes;
}

// Extract speaker notes from markdown file
function extractSpeakerNotes(markdownPath: string): string[] {
  const content = fs.readFileSync(markdownPath, "utf-8");
  const slides = parseSlides(content);
  return extractNotesFromSlides(slides);
}

// Extract notes from a single slide
export function extractNotesFromSlide(slideContent: string): string {
  const commentRegex = /<!--\s*([\s\S]*?)\s*-->/g;
  const matches: string[] = [];
  let match;

  while ((match = commentRegex.exec(slideContent)) !== null) {
    matches.push(match[1].trim());
  }

  // Join multiple comments with newlines
  return matches.join("\n");
}

// Render slides to images using Marp CLI
function renderSlidesToImages(markdownPath: string): number {
  const outputFolder = path.join(process.cwd(), "output");
  const imagesFolder = path.join(outputFolder, "images");

  // Execute Marp CLI to generate PNG images directly
  try {
    execSync(
      `npx @marp-team/marp-cli "${markdownPath}" -o "${imagesFolder}/slide.png" --images png`,
      {
        stdio: "inherit",
      }
    );
  } catch (error) {
    console.error("Error: Failed to render Marp presentation to images", error);
    console.error("Make sure @marp-team/marp-cli is installed");
    process.exit(1);
  }

  // Count generated images
  const files = fs.readdirSync(imagesFolder);
  const imageFiles = files.filter((f) => f.startsWith("slide.") && f.endsWith(".png"));
  const slideCount = imageFiles.length;

  // Rename generated images to match expected format (images.001.png, etc.)
  renameGeneratedImages(imagesFolder, slideCount);

  return slideCount;
}

// Rename Marp-generated images to expected format
function renameGeneratedImages(imagesFolder: string, slideCount: number): void {
  for (let i = 1; i <= slideCount; i++) {
    const marpFilename = `slide.${String(i).padStart(3, "0")}.png`;
    const expectedFilename = `images.${String(i).padStart(3, "0")}.png`;
    const marpPath = path.join(imagesFolder, marpFilename);
    const expectedPath = path.join(imagesFolder, expectedFilename);

    if (fs.existsSync(marpPath)) {
      fs.renameSync(marpPath, expectedPath);
    }
  }
}

// Generate MulmoScript JSON with image paths
function generateMulmoScriptImage(notes: string[], slideCount: number): void {
  const outputFolder = path.join(process.cwd(), "output");
  const imagesFolder = path.join(outputFolder, "images");

  // Align notes array length with slide count
  while (notes.length < slideCount) {
    notes.push("");
  }

  const beats: Beat[] = notes.slice(0, slideCount).map((note, index) => {
    const slideNum = String(index + 1).padStart(3, "0");
    const imagePath = path.join(imagesFolder, `images.${slideNum}.png`);

    return {
      text: note || "",
      image: {
        type: "image",
        source: {
          kind: "path",
          path: imagePath,
        },
      },
    };
  });

  const mulmocast: MulmoScript = {
    $mulmocast: {
      version: "1.1",
      credit: "closing",
    },
    beats,
  };

  const scriptPath = path.join(outputFolder, "script.json");
  fs.writeFileSync(scriptPath, JSON.stringify(mulmocast, null, 2), "utf-8");
}

// Extract markdown content from a single slide (removes HTML comments)
export function extractMarkdownFromSlide(slideContent: string): string[] {
  // Remove HTML comments (speaker notes)
  const slideWithoutNotes = slideContent.replace(/<!--\s*[\s\S]*?\s*-->/g, "");

  // Split into lines, trim, and filter out empty lines
  const lines = slideWithoutNotes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines;
}

// Extract markdown content from parsed slides
export function extractMarkdownFromSlides(slides: string[]): string[][] {
  const slideMarkdowns: string[][] = [];

  for (const slide of slides) {
    slideMarkdowns.push(extractMarkdownFromSlide(slide));
  }

  return slideMarkdowns;
}

// Extract markdown content from each slide in a file
function extractSlideMarkdown(markdownPath: string): string[][] {
  const content = fs.readFileSync(markdownPath, "utf-8");
  const slides = parseSlides(content);
  return extractMarkdownFromSlides(slides);
}

// Generate MulmoScript JSON with Markdown
function generateMulmoScriptMarkdown(notes: string[], slideMarkdowns: string[][]): void {
  const outputFolder = path.join(process.cwd(), "output");

  // Align notes array length with slide count
  while (notes.length < slideMarkdowns.length) {
    notes.push("");
  }

  const beats: Beat[] = slideMarkdowns.map((markdown, index) => {
    return {
      text: notes[index] || "",
      image: {
        type: "markdown",
        markdown,
      },
    };
  });

  const mulmocast: MulmoScript = {
    $mulmocast: {
      version: "1.1",
      credit: "closing",
    },
    beats,
  };

  const scriptPath = path.join(outputFolder, "script-markdown.json");
  fs.writeFileSync(scriptPath, JSON.stringify(mulmocast, null, 2), "utf-8");
}

// Cleanup temporary files
function cleanupTempFiles(): void {
  const outputFolder = path.join(process.cwd(), "output");
  const tempFolder = path.join(outputFolder, ".temp");

  if (fs.existsSync(tempFolder)) {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

// Main function
async function main() {
  try {
    console.log("Starting Marp to MulmoScript conversion...\n");

    // Parse arguments
    const inputPath = parseArguments();
    console.log(`Input file: ${inputPath}`);

    // Setup output directories
    setupOutputDirectories();
    console.log("Output directories prepared");

    // Extract speaker notes
    const notes = extractSpeakerNotes(inputPath);
    console.log(`Extracted ${notes.length} speaker notes`);

    // Render to images
    console.log("Rendering slides to images...");
    const slideCount = renderSlidesToImages(inputPath);
    console.log(`Rendered ${slideCount} slides`);

    // Extract markdown for markdown format
    console.log("Extracting slide markdown...");
    const slideMarkdowns = extractSlideMarkdown(inputPath);
    console.log(`Extracted ${slideMarkdowns.length} slide markdowns`);

    // Generate both MulmoScript formats
    console.log("Generating MulmoScript JSON files...");
    generateMulmoScriptImage(notes, slideCount);
    console.log("✓ Created output/script.json (PNG format)");

    generateMulmoScriptMarkdown(notes, slideMarkdowns);
    console.log("✓ Created output/script-markdown.json (Markdown format)");

    // Cleanup
    cleanupTempFiles();

    console.log(`\n✓ Successfully generated MulmoScript with ${slideCount} slides`);
  } catch (error) {
    console.error("\n✗ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute only when run directly
if (require.main === module) {
  main();
}

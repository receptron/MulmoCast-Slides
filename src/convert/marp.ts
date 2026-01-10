#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { mulmoScriptSchema, type MulmoBeat } from "mulmocast";
import type { z } from "zod";

type MulmoScriptInput = z.input<typeof mulmoScriptSchema>;
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { resolveLang, langOption, type SupportedLang } from "../utils/lang";
import { generateTextFromMarkdown } from "../utils/llm";

export interface ConvertMarpOptions {
  inputPath: string;
  outputDir?: string;
  themePath?: string;
  allowLocalFiles?: boolean;
  lang?: SupportedLang;
  generateText?: boolean;
}

export interface ConvertMarpResult {
  mulmoScriptPath: string;
  markdownScriptPath: string;
  slideCount: number;
}

// Parse markdown content into slides (removes YAML front matter)
export function parseSlides(content: string): string[] {
  // Split by slide separator
  const slides = content.split(/\n---\n/);

  // Remove YAML front matter (first section if it starts with ---)
  if (slides.length > 0 && slides[0].trim().startsWith("---")) {
    slides.shift();
  }

  return slides;
}

// Extract notes from a single slide
export function extractNotesFromSlide(slideContent: string): string {
  const commentRegex = /<!--\s*([\s\S]*?)\s*-->/g;
  const matches = [...slideContent.matchAll(commentRegex)].map((m) => m[1].trim());
  return matches.join("\n");
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

// Setup output directories
function setupOutputDirectories(basename: string, customOutputDir?: string): string {
  const outputFolder = customOutputDir || path.join(process.cwd(), "scripts", basename);
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

  return outputFolder;
}

// Extract speaker notes from markdown file
function extractSpeakerNotes(markdownPath: string): string[] {
  const content = fs.readFileSync(markdownPath, "utf-8");
  const slides = parseSlides(content);
  return extractNotesFromSlides(slides);
}

// Render slides to images using Marp CLI
function renderSlidesToImages(
  markdownPath: string,
  outputFolder: string,
  themePath?: string,
  allowLocalFiles: boolean = false
): number {
  const imagesFolder = path.join(outputFolder, "images");

  // Build Marp CLI command with optional theme and allow-local-files
  const marpCommand = [
    `npx @marp-team/marp-cli "${markdownPath}" -o "${imagesFolder}/slide.png" --images png`,
    themePath ? `--theme "${themePath}"` : "",
    allowLocalFiles ? "--allow-local-files" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Execute Marp CLI to generate PNG images directly
  try {
    execSync(marpCommand, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error("Error: Failed to render Marp presentation to images", error);
    console.error("Make sure @marp-team/marp-cli is installed");
    throw new Error("Failed to render Marp presentation");
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
  Array.from({ length: slideCount }, (_, i) => i + 1).forEach((i) => {
    const marpFilename = `slide.${String(i).padStart(3, "0")}.png`;
    const expectedFilename = `images.${String(i).padStart(3, "0")}.png`;
    const marpPath = path.join(imagesFolder, marpFilename);
    const expectedPath = path.join(imagesFolder, expectedFilename);

    if (fs.existsSync(marpPath)) {
      fs.renameSync(marpPath, expectedPath);
    }
  });
}

// Generate MulmoScript JSON with image paths
function generateMulmoScriptImage(
  notes: string[],
  slideCount: number,
  outputFolder: string,
  lang: SupportedLang
): string {
  const imagesFolder = path.join(outputFolder, "images");

  // Align notes array length with slide count
  while (notes.length < slideCount) {
    notes.push("");
  }

  const beats: MulmoBeat[] = notes.slice(0, slideCount).map((note, index) => {
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

  const mulmocast: MulmoScriptInput = {
    $mulmocast: {
      version: "1.1",
      credit: "closing",
    },
    lang,
    beats,
  };

  // Validate mulmoScript
  const result = mulmoScriptSchema.safeParse(mulmocast);
  if (!result.success) {
    console.error("MulmoScript validation failed:");
    console.error(result.error.format());
    throw new Error("Invalid MulmoScript generated");
  }

  const scriptPath = path.join(outputFolder, "mulmo_script.json");
  fs.writeFileSync(scriptPath, JSON.stringify(result.data, null, 2), "utf-8");
  return scriptPath;
}

// Extract markdown content from each slide in a file
function extractSlideMarkdown(markdownPath: string): string[][] {
  const content = fs.readFileSync(markdownPath, "utf-8");
  const slides = parseSlides(content);
  return extractMarkdownFromSlides(slides);
}

// Generate MulmoScript JSON with Markdown
function generateMulmoScriptMarkdown(
  notes: string[],
  slideMarkdowns: string[][],
  outputFolder: string,
  lang: SupportedLang
): string {
  // Align notes array length with slide count
  while (notes.length < slideMarkdowns.length) {
    notes.push("");
  }

  const beats: MulmoBeat[] = slideMarkdowns.map((markdown, index) => {
    return {
      text: notes[index] || "",
      image: {
        type: "markdown",
        markdown,
      },
    };
  });

  const mulmocast: MulmoScriptInput = {
    $mulmocast: {
      version: "1.1",
      credit: "closing",
    },
    lang,
    beats,
  };

  // Validate mulmoScript
  const result = mulmoScriptSchema.safeParse(mulmocast);
  if (!result.success) {
    console.error("MulmoScript (markdown) validation failed:");
    console.error(result.error.format());
    throw new Error("Invalid MulmoScript generated");
  }

  const scriptPath = path.join(outputFolder, "mulmo_script-markdown.json");
  fs.writeFileSync(scriptPath, JSON.stringify(result.data, null, 2), "utf-8");
  return scriptPath;
}

// Cleanup temporary files
function cleanupTempFiles(outputFolder: string): void {
  const tempFolder = path.join(outputFolder, ".temp");

  if (fs.existsSync(tempFolder)) {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

// Main conversion function (exported for use by movie command)
export async function convertMarp(options: ConvertMarpOptions): Promise<ConvertMarpResult> {
  const inputPath = path.resolve(options.inputPath);
  const themePath = options.themePath ? path.resolve(options.themePath) : undefined;
  const allowLocalFiles = options.allowLocalFiles ?? false;
  const generateText = options.generateText ?? false;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  if (!inputPath.endsWith(".md")) {
    throw new Error("Input file must be a .md (Markdown) file");
  }

  if (themePath && !fs.existsSync(themePath)) {
    throw new Error(`Theme file not found: ${themePath}`);
  }

  console.log("Starting Marp to MulmoScript conversion...\n");
  console.log(`Input file: ${inputPath}`);
  if (themePath) {
    console.log(`Custom theme: ${themePath}`);
  }
  if (allowLocalFiles) {
    console.log(`Allow local files: enabled`);
  }

  // Get basename from input file
  const basename = path.basename(inputPath, ".md");

  // Setup output directories
  const outputFolder = setupOutputDirectories(basename, options.outputDir);
  console.log(`Output directory: ${outputFolder}`);

  // Extract speaker notes
  const notes = extractSpeakerNotes(inputPath);
  console.log(`Extracted ${notes.length} speaker notes`);

  // Resolve language (with auto-detection from notes)
  const lang = resolveLang(options.lang, notes);

  // Render to images
  console.log("Rendering slides to images...");
  const slideCount = renderSlidesToImages(inputPath, outputFolder, themePath, allowLocalFiles);
  console.log(`Rendered ${slideCount} slides`);

  // Extract markdown for markdown format
  console.log("Extracting slide markdown...");
  const slideMarkdowns = extractSlideMarkdown(inputPath);
  console.log(`Extracted ${slideMarkdowns.length} slide markdowns`);

  // Generate text using LLM if requested
  if (generateText) {
    console.log("Generating narration text with LLM...");
    const slides = slideMarkdowns.map((markdown, index) => ({
      index,
      markdown,
      existingText: notes[index] || "",
    }));

    const generatedTexts = await generateTextFromMarkdown({
      slides,
      lang,
      title: basename,
    });

    for (const generated of generatedTexts) {
      if (generated.index < notes.length) {
        notes[generated.index] = generated.text;
      } else {
        notes.push(generated.text);
      }
    }
    console.log(`Generated text for ${generatedTexts.length} slides`);
  }

  // Generate both MulmoScript formats
  console.log("Generating MulmoScript JSON files...");
  const mulmoScriptPath = generateMulmoScriptImage(notes, slideCount, outputFolder, lang);
  console.log(`✓ Created ${mulmoScriptPath} (PNG format)`);

  const markdownScriptPath = generateMulmoScriptMarkdown(notes, slideMarkdowns, outputFolder, lang);
  console.log(`✓ Created ${markdownScriptPath} (Markdown format)`);

  // Cleanup
  cleanupTempFiles(outputFolder);

  console.log(`\n✓ Successfully generated MulmoScript with ${slideCount} slides`);

  return {
    mulmoScriptPath,
    markdownScriptPath,
    slideCount,
  };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: $0 <marp-file.md> [options]")
    .command("$0 <file>", "Convert Marp markdown to MulmoScript", (yargs) => {
      return yargs.positional("file", {
        describe: "Marp markdown file to convert",
        type: "string",
        demandOption: true,
      });
    })
    .options({
      ...langOption,
      theme: {
        type: "string",
        description: "Path to custom theme CSS file",
      },
      "allow-local-files": {
        type: "boolean",
        description: "Allow local file access in Marp",
        default: false,
      },
      g: {
        alias: "generate-text",
        type: "boolean",
        description: "Generate narration text using LLM",
        default: false,
      },
    })
    .help()
    .parse();

  await convertMarp({
    inputPath: argv.file as string,
    lang: argv.l as SupportedLang | undefined,
    themePath: argv.theme,
    allowLocalFiles: argv["allow-local-files"],
    generateText: argv.g,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\n✗ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

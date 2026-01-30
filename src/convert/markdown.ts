#!/usr/bin/env tsx

/**
 * Markdown to MulmoScript converter
 *
 * Converts plain markdown files (with --- separators) to MulmoScript format.
 * Unlike the Marp converter, this does NOT generate images - it keeps markdown as-is.
 *
 * Slide separator: ---
 * Speaker notes: HTML comments <!-- note content -->
 */

import * as fs from "fs";
import * as path from "path";
import { mulmoScriptSchema, type MulmoBeat } from "mulmocast";
import type { z } from "zod";

type MulmoScriptInput = z.input<typeof mulmoScriptSchema>;
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { resolveLang, langOption, type SupportedLang } from "../utils/lang";
import { generateTextFromMarkdown } from "../utils/llm";

export interface ConvertMarkdownOptions {
  inputPath: string;
  outputDir?: string;
  lang?: SupportedLang;
  generateText?: boolean;
}

export interface ConvertMarkdownResult {
  mulmoScriptPath: string;
  slideCount: number;
}

// Parse markdown content into slides (splits by ---)
export function parseSlides(content: string): string[] {
  // Normalize line endings
  const normalized = content.replace(/\r\n/g, "\n");

  // Split by slide separator (--- on its own line)
  const slides = normalized.split(/\n---\n/);

  // Check if first section is YAML front matter (starts with ---)
  if (slides.length > 0) {
    const firstSlide = slides[0].trim();
    // YAML front matter starts with --- at the very beginning
    if (firstSlide.startsWith("---")) {
      // Remove the YAML front matter
      slides.shift();
    }
  }

  // Filter out empty slides
  return slides.filter((slide) => slide.trim().length > 0);
}

// Extract speaker notes from HTML comments in a slide
export function extractNotesFromSlide(slideContent: string): string {
  const commentRegex = /<!--\s*([\s\S]*?)\s*-->/g;
  const matches = [...slideContent.matchAll(commentRegex)].map((m) => m[1].trim());
  return matches.join("\n");
}

// Extract markdown content from a slide (removes HTML comments)
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

// Setup output directory
function setupOutputDirectory(basename: string, customOutputDir?: string): string {
  const outputFolder = customOutputDir || path.join(process.cwd(), "scripts", basename);

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  return outputFolder;
}

// Generate MulmoScript JSON with Markdown content
function generateMulmoScript(
  slides: string[],
  notes: string[],
  outputFolder: string,
  lang: SupportedLang
): string {
  const beats: MulmoBeat[] = slides.map((slideContent, index) => {
    const markdown = extractMarkdownFromSlide(slideContent);
    const text = notes[index] || "";

    return {
      text,
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
    console.error("MulmoScript validation failed:");
    console.error(result.error.format());
    throw new Error("Invalid MulmoScript generated");
  }

  const scriptPath = path.join(outputFolder, "mulmo_script.json");
  fs.writeFileSync(scriptPath, JSON.stringify(result.data, null, 2), "utf-8");
  return scriptPath;
}

// Main conversion function
export async function convertMarkdown(
  options: ConvertMarkdownOptions
): Promise<ConvertMarkdownResult> {
  const inputPath = path.resolve(options.inputPath);
  const generateText = options.generateText ?? false;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  if (!inputPath.endsWith(".md")) {
    throw new Error("Input file must be a .md (Markdown) file");
  }

  console.log("Starting Markdown to MulmoScript conversion...\n");
  console.log(`Input file: ${inputPath}`);

  // Get basename from input file
  const basename = path.basename(inputPath, ".md");

  // Setup output directory
  const outputFolder = setupOutputDirectory(basename, options.outputDir);
  console.log(`Output directory: ${outputFolder}`);

  // Read and parse markdown
  const content = fs.readFileSync(inputPath, "utf-8");
  const slides = parseSlides(content);
  const slideCount = slides.length;
  console.log(`Found ${slideCount} slides`);

  // Extract speaker notes from each slide
  const notes = slides.map((slide) => extractNotesFromSlide(slide));
  const notesCount = notes.filter((n) => n.length > 0).length;
  console.log(`Extracted ${notesCount} speaker notes`);

  // Resolve language (with auto-detection from notes)
  const lang = resolveLang(options.lang, notes);

  // Generate text using LLM if requested
  if (generateText) {
    console.log("Generating narration text with LLM...");
    const slideData = slides.map((slideContent, index) => ({
      index,
      markdown: extractMarkdownFromSlide(slideContent),
      existingText: notes[index] || "",
    }));

    const generatedTexts = await generateTextFromMarkdown({
      slides: slideData,
      lang,
      title: basename,
    });

    for (const generated of generatedTexts) {
      notes[generated.index] = generated.text;
    }
    console.log(`Generated text for ${generatedTexts.length} slides`);
  }

  // Generate MulmoScript
  console.log("Generating MulmoScript JSON...");
  const mulmoScriptPath = generateMulmoScript(slides, notes, outputFolder, lang);
  console.log(`✓ Created ${mulmoScriptPath}`);

  console.log(`\n✓ Successfully converted ${slideCount} slides to MulmoScript`);

  return {
    mulmoScriptPath,
    slideCount,
  };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: $0 <markdown-file.md> [options]")
    .command("$0 <file>", "Convert Markdown to MulmoScript", (yargs) => {
      return yargs.positional("file", {
        describe: "Markdown file to convert",
        type: "string",
        demandOption: true,
      });
    })
    .options({
      ...langOption,
      g: {
        alias: "generate-text",
        type: "boolean",
        description: "Generate narration text using LLM",
        default: false,
      },
    })
    .help()
    .parse();

  await convertMarkdown({
    inputPath: argv.file as string,
    lang: argv.l as SupportedLang | undefined,
    generateText: argv.g,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\n✗ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

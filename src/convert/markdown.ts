#!/usr/bin/env tsx

/**
 * Markdown to MulmoScript converter
 *
 * Converts plain markdown files to MulmoScript format.
 * Supports multiple separator modes and plugin system.
 *
 * Separator modes:
 * - horizontal-rule (default): ---
 * - heading: # or ## or ###
 * - heading-1/2/3: specific heading level
 * - blank-lines: 3+ blank lines
 * - comment: <!-- slide -->
 * - custom: regex pattern
 *
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
import { splitIntoSlides, processMarkdown, type SeparatorMode } from "./markdown-plugins";

export interface ConvertMarkdownOptions {
  inputPath: string;
  outputDir?: string;
  lang?: SupportedLang;
  generateText?: boolean;
  separator?: SeparatorMode;
  mermaid?: boolean;
  directive?: boolean;
  style?: string;
}

export interface ConvertMarkdownResult {
  mulmoScriptPath: string;
  slideCount: number;
}

// Parse markdown content into slides (legacy function, now uses splitIntoSlides)
export function parseSlides(
  content: string,
  separator: SeparatorMode = "horizontal-rule"
): string[] {
  return splitIntoSlides(content, separator);
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
  lang: SupportedLang,
  options: { style?: string; customBeats?: (Partial<MulmoBeat> | null)[] } = {}
): string {
  const beats: MulmoBeat[] = slides.map((slideContent, index) => {
    // Check if plugin generated a custom beat
    const customBeat = options.customBeats?.[index];
    if (customBeat && customBeat.image) {
      return {
        text: customBeat.text || notes[index] || "",
        image: customBeat.image,
      } as MulmoBeat;
    }

    // Default: markdown beat
    const markdown = extractMarkdownFromSlide(slideContent);
    const text = notes[index] || "";

    // Build image object with optional style
    const image: { type: "markdown"; markdown: string[]; style?: string } = {
      type: "markdown",
      markdown,
    };

    if (options.style) {
      image.style = options.style;
    }

    return {
      text,
      image,
    } as MulmoBeat;
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
  const separator = options.separator ?? "horizontal-rule";

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  if (!inputPath.endsWith(".md")) {
    throw new Error("Input file must be a .md (Markdown) file");
  }

  console.log("Starting Markdown to MulmoScript conversion...\n");
  console.log(`Input file: ${inputPath}`);
  console.log(`Separator: ${typeof separator === "string" ? separator : "custom pattern"}`);

  // Get basename from input file
  const basename = path.basename(inputPath, ".md");

  // Setup output directory
  const outputFolder = setupOutputDirectory(basename, options.outputDir);
  console.log(`Output directory: ${outputFolder}`);

  // Read and parse markdown with specified separator
  const content = fs.readFileSync(inputPath, "utf-8");
  const slides = parseSlides(content, separator);
  const slideCount = slides.length;
  console.log(`Found ${slideCount} slides`);

  // Process through plugins if specified
  let processedSlides = slides;
  let customBeats: (Partial<MulmoBeat> | null)[] = [];

  if (options.mermaid || options.directive) {
    const enabledPlugins = [options.mermaid && "mermaid", options.directive && "directive"]
      .filter(Boolean)
      .join(", ");
    console.log(`Applying plugins: ${enabledPlugins}`);
    const results = processMarkdown(slides, {
      mermaid: options.mermaid,
      directive: options.directive,
    });
    processedSlides = results.map((r) => r.markdown);
    customBeats = results.map((r) => r.beat);
  }

  // Extract speaker notes from each slide
  const notes = processedSlides.map((slide) => extractNotesFromSlide(slide));
  const notesCount = notes.filter((n) => n.length > 0).length;
  console.log(`Extracted ${notesCount} speaker notes`);

  // Resolve language (with auto-detection from notes)
  const lang = resolveLang(options.lang, notes);

  // Generate text using LLM if requested
  if (generateText) {
    console.log("Generating narration text with LLM...");
    const slideData = processedSlides.map((slideContent, index) => ({
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
  const mulmoScriptPath = generateMulmoScript(processedSlides, notes, outputFolder, lang, {
    style: options.style,
    customBeats,
  });
  console.log(`✓ Created ${mulmoScriptPath}`);

  console.log(`\n✓ Successfully converted ${slideCount} slides to MulmoScript`);

  return {
    mulmoScriptPath,
    slideCount,
  };
}

const SEPARATOR_CHOICES = [
  "horizontal-rule",
  "heading",
  "heading-1",
  "heading-2",
  "heading-3",
  "blank-lines",
  "comment",
  "page-break",
] as const;

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
      s: {
        alias: "separator",
        type: "string",
        description: "Slide separator mode",
        choices: SEPARATOR_CHOICES,
        default: "horizontal-rule",
      },
      mermaid: {
        type: "boolean",
        description: "Convert mermaid code blocks to mermaid beat type",
        default: false,
      },
      directive: {
        type: "boolean",
        description: "Remove Marp-style directives (<!-- _class: ... -->)",
        default: false,
      },
      style: {
        type: "string",
        description: "Markdown slide style (e.g., corporate-blue, finance-green)",
      },
    })
    .help()
    .parse();

  await convertMarkdown({
    inputPath: argv.file as string,
    lang: argv.l as SupportedLang | undefined,
    generateText: argv.g,
    separator: argv.s as SeparatorMode,
    mermaid: argv.mermaid,
    directive: argv.directive,
    style: argv.style as string | undefined,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\n✗ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

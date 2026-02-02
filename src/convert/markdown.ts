#!/usr/bin/env tsx

/**
 * Markdown to MulmoScript converter
 *
 * Converts plain markdown files to MulmoScript format.
 * Supports multiple separator modes and plugin system.
 */

import * as path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { resolveLang, langOption, type SupportedLang } from "../utils/lang";
import { generateTextFromMarkdown } from "../utils/llm";
import { splitIntoSlides, processMarkdown, type SeparatorMode } from "./markdown-plugins";
import {
  type Slide,
  type ConvertMarkdownOptions,
  type ConvertMarkdownResult,
  SEPARATOR_CHOICES,
  extractNotesFromSlide,
  extractMarkdownFromSlide,
  readMarkdownFile,
  setupOutputDirectory,
  writeMulmoScript,
} from "./markdown-utils";

// Re-export types for external use
export type { ConvertMarkdownOptions, ConvertMarkdownResult };
export { extractNotesFromSlide, extractMarkdownFromSlide };

// ============================================================================
// Beat Generation
// ============================================================================

function slideToBeat(slide: Slide, style?: string) {
  // Use plugin-generated beat if available (e.g., mermaid with row-2 layout)
  if (slide.beat?.image) {
    return { text: slide.beat.text || slide.note, image: slide.beat.image };
  }

  // Default: markdown beat
  const markdown = extractMarkdownFromSlide(slide.markdown);
  return {
    text: slide.note,
    image: style
      ? { type: "markdown" as const, markdown, style }
      : { type: "markdown" as const, markdown },
  };
}

function slidesToMulmoScript(slides: Slide[], lang: SupportedLang, style?: string) {
  return {
    $mulmocast: { version: "1.1", credit: "closing" },
    lang,
    beats: slides.map((slide) => slideToBeat(slide, style)),
  };
}

/**
 * Convert markdown file to MulmoScript
 */
export async function convertMarkdown(
  options: ConvertMarkdownOptions
): Promise<ConvertMarkdownResult> {
  const inputPath = path.resolve(options.inputPath);
  const separator = options.separator ?? "horizontal-rule";

  console.log("Starting Markdown to MulmoScript conversion...\n");
  console.log(`Input file: ${inputPath}`);
  console.log(`Separator: ${typeof separator === "string" ? separator : "custom pattern"}`);

  // Setup
  const basename = path.basename(inputPath, ".md");
  const outputFolder = setupOutputDirectory(basename, options.outputDir);
  console.log(`Output directory: ${outputFolder}`);

  // Read and split into slides
  const content = readMarkdownFile(inputPath);
  const rawSlides = splitIntoSlides(content, separator);
  console.log(`Found ${rawSlides.length} slides`);

  // Log enabled plugins
  const enabledPlugins = [options.mermaid && "mermaid", options.directive && "directive"].filter(
    Boolean
  );
  if (enabledPlugins.length > 0) {
    console.log(`Applying plugins: ${enabledPlugins.join(", ")}`);
  }

  // Process slides: apply plugins and extract notes
  const slides: Slide[] = processMarkdown(rawSlides, {
    mermaid: options.mermaid,
    directive: options.directive,
  }).map(({ markdown, beat }) => ({
    markdown,
    beat,
    note: extractNotesFromSlide(markdown),
  }));

  // Resolve language
  const lang = resolveLang(
    options.lang,
    slides.map((slide) => slide.note)
  );

  // Generate narration text with LLM if requested
  if (options.generateText) {
    console.log("Generating narration text with LLM...");
    const slideData = slides.map((slide, index) => ({
      index,
      markdown: extractMarkdownFromSlide(slide.markdown),
      existingText: slide.note,
    }));

    const generatedTexts = await generateTextFromMarkdown({
      slides: slideData,
      lang,
      title: basename,
    });

    generatedTexts.forEach((generated) => {
      slides[generated.index].note = generated.text;
    });
    console.log(`Generated text for ${generatedTexts.length} slides`);
  }

  // Generate and write MulmoScript
  console.log("Generating MulmoScript JSON...");
  const mulmoScript = slidesToMulmoScript(slides, lang, options.style);
  const mulmoScriptPath = writeMulmoScript(outputFolder, mulmoScript);
  console.log(`✓ Created ${mulmoScriptPath}`);

  console.log(`\n✓ Successfully converted ${slides.length} slides to MulmoScript`);

  return { mulmoScriptPath, slideCount: slides.length };
}

// ============================================================================
// CLI
// ============================================================================

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

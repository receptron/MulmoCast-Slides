#!/usr/bin/env tsx

import { audio, images, movie, translate, captions } from "mulmocast";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initializeContext, runAction } from "./common";

interface MovieOptions {
  targetLang?: string;
  captionLang?: string;
}

async function runMulmoMovie(
  mulmoScriptPath: string,
  outputDir: string,
  options: MovieOptions = {}
): Promise<void> {
  console.log(`\nGenerating movie with mulmo...`);
  console.log(`  Input: ${mulmoScriptPath}`);
  console.log(`  Output: ${outputDir}`);

  const context = await initializeContext(mulmoScriptPath, outputDir, {
    targetLang: options.targetLang,
    captionLang: options.captionLang,
  });
  const current = { context };

  // Translate if targetLang differs from script's original lang
  const scriptLang = current.context.studio.script.lang;
  if (options.targetLang && options.targetLang !== scriptLang) {
    console.log(`  Translating from ${scriptLang} to ${options.targetLang}...`);
    current.context = await translate(current.context, { targetLangs: [options.targetLang] });
  }

  console.log("  Generating audio...");
  current.context = await audio(current.context);

  if (options.captionLang) {
    console.log(`  Generating captions (${options.captionLang})...`);
    current.context = await captions(current.context);
  }

  console.log("  Generating images...");
  current.context = await images(current.context);

  console.log("  Creating movie...");
  const result = await movie(current.context);
  if (!result) {
    throw new Error("Movie generation failed");
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: $0 <presentation-file> [options]")
    .command("$0 <file>", "Generate movie from presentation", (yargs) => {
      return yargs.positional("file", {
        describe: "Presentation file (.pptx, .md, .key)",
        type: "string",
        demandOption: true,
      });
    })
    .options({
      f: {
        alias: "force",
        type: "boolean",
        description: "Force regenerate MulmoScript",
        default: false,
      },
      g: {
        alias: "generate-text",
        type: "boolean",
        description: "Generate narration text using LLM",
        default: false,
      },
      t: {
        alias: "target-lang",
        type: "string",
        description: "Target language for audio generation (e.g., ja, en, fr, de)",
      },
      c: {
        alias: "caption",
        type: "string",
        description: "Caption/subtitle language (e.g., ja, en, fr, de)",
      },
    })
    .help()
    .parse();

  const targetLang = argv.t;
  const captionLang = argv.c;

  // Create a runner that captures options
  const runner = (mulmoScriptPath: string, outputDir: string) =>
    runMulmoMovie(mulmoScriptPath, outputDir, { targetLang, captionLang });

  await runAction("Movie", argv.file as string, runner, {
    force: argv.f,
    generateText: argv.g,
  });
}

main();

#!/usr/bin/env tsx

import { audio, images, movie } from "mulmocast";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initializeContext, runAction } from "./common";

async function runMulmoMovie(mulmoScriptPath: string, outputDir: string): Promise<void> {
  console.log(`\nGenerating movie with mulmo...`);
  console.log(`  Input: ${mulmoScriptPath}`);
  console.log(`  Output: ${outputDir}`);

  const context = await initializeContext(mulmoScriptPath, outputDir);

  console.log("  Generating audio...");
  const audioContext = await audio(context);

  console.log("  Generating images...");
  const imageContext = await images(audioContext);

  console.log("  Creating movie...");
  const result = await movie(imageContext);
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
    })
    .help()
    .parse();

  await runAction("Movie", argv.file as string, runMulmoMovie, {
    force: argv.f,
    generateText: argv.g,
  });
}

main();

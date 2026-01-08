#!/usr/bin/env tsx

import { audio, images, translate, mulmoViewerBundle, bundleTargetLang } from "mulmocast";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initializeContext, runAction } from "./common";

async function runMulmoBundle(mulmoScriptPath: string, outputDir: string): Promise<void> {
  console.log(`\nGenerating bundle with mulmo...`);
  console.log(`  Input: ${mulmoScriptPath}`);
  console.log(`  Output: ${outputDir}`);

  const context = await initializeContext(mulmoScriptPath, outputDir);

  console.log("  Translating...");
  await translate(context, { targetLangs: bundleTargetLang });

  for (const lang of bundleTargetLang.filter((_lang) => _lang !== context.lang)) {
    await audio({ ...context, lang });
  }

  console.log("  Generating audio...");
  const audioContext = await audio(context);

  console.log("  Generating images...");
  const imageContext = await images(audioContext);

  console.log("  Creating bundle...");
  await mulmoViewerBundle(imageContext, { skipZip: true });
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: $0 <presentation-file> [options]")
    .command("$0 <file>", "Generate MulmoViewer bundle from presentation", (yargs) => {
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

  await runAction("Bundle", argv.file as string, runMulmoBundle, {
    force: argv.f,
    generateText: argv.g,
  });
}

main();

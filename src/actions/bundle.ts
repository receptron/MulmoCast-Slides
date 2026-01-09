#!/usr/bin/env tsx

import { audio, images, translate, mulmoViewerBundle, bundleTargetLang } from "mulmocast";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initializeContext, runAction } from "./common";

async function runMulmoBundle(mulmoScriptPath: string, outputDir: string): Promise<void> {
  console.log(`\nGenerating bundle with mulmo...`);
  console.log(`  Input: ${mulmoScriptPath}`);
  console.log(`  Output: ${outputDir}`);

  let currentContext = await initializeContext(mulmoScriptPath, outputDir);

  console.log("  Translating...");
  currentContext = await translate(currentContext, { targetLangs: bundleTargetLang });

  for (const lang of bundleTargetLang.filter((_lang) => _lang !== currentContext.lang)) {
    console.log(`  Generating audio (${lang})...`);
    currentContext = await audio({ ...currentContext, lang });
  }

  console.log(`  Generating audio (${currentContext.lang})...`);
  currentContext = await audio(currentContext);

  console.log("  Generating images...");
  currentContext = await images(currentContext);

  console.log("  Creating bundle...");
  await mulmoViewerBundle(currentContext, { skipZip: true });
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

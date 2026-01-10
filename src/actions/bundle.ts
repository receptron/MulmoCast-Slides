#!/usr/bin/env tsx

import { audio, images, translate, mulmoViewerBundle, bundleTargetLang } from "mulmocast";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initializeContext, runAction } from "./common";

export async function runMulmoBundle(mulmoScriptPath: string, outputDir: string): Promise<void> {
  console.log(`\nGenerating bundle with mulmo...`);
  console.log(`  Input: ${mulmoScriptPath}`);
  console.log(`  Output: ${outputDir}`);

  const context = await initializeContext(mulmoScriptPath, outputDir);
  const current = { context };

  console.log("  Translating...");
  current.context = await translate(current.context, { targetLangs: bundleTargetLang });

  for (const lang of bundleTargetLang.filter((_lang) => _lang !== current.context.lang)) {
    console.log(`  Generating audio (${lang})...`);
    current.context = await audio({ ...current.context, lang });
  }

  console.log(`  Generating audio (${current.context.lang})...`);
  current.context = await audio(current.context);

  console.log("  Generating images...");
  current.context = await images(current.context);

  console.log("  Creating bundle...");
  await mulmoViewerBundle(current.context, { skipZip: true });
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

// Only run main() when executed directly, not when imported
const isDirectRun = process.argv[1]?.endsWith("bundle.ts") || process.argv[1]?.endsWith("bundle.js");
if (isDirectRun) {
  main();
}

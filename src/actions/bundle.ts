#!/usr/bin/env tsx

import { audio, images, translate, mulmoViewerBundle, bundleTargetLang } from "mulmocast";
import { initializeContext, runAction, showUsage } from "./common";

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
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showUsage("bundle");
  }

  await runAction("Bundle", args[0], runMulmoBundle);
}

main();

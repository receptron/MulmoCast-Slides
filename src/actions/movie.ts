#!/usr/bin/env tsx

import { audio, images, movie } from "mulmocast";
import { initializeContext, runAction, showUsage } from "./common";

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
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showUsage("movie");
  }

  await runAction("Movie", args[0], runMulmoMovie);
}

main();

#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";
import { execSync, spawnSync } from "child_process";

type FileType = "pptx" | "marp" | "keynote";

function detectFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".pptx":
      return "pptx";
    case ".md":
      return "marp";
    case ".key":
      return "keynote";
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

function getBasename(filePath: string): string {
  const ext = path.extname(filePath);
  return path.basename(filePath, ext);
}

function convertToMulmoScript(filePath: string, fileType: FileType): string {
  const basename = getBasename(filePath);
  const absolutePath = path.resolve(filePath);

  console.log(`Converting ${fileType.toUpperCase()} to MulmoScript...`);

  switch (fileType) {
    case "pptx": {
      execSync(`npx tsx src/pptx/convert.ts "${absolutePath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      return path.join("scripts", basename, "mulmoScript.json");
    }
    case "marp": {
      execSync(`tsx src/marp/extract.ts "${absolutePath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      return path.join("scripts", basename, "script.json");
    }
    case "keynote": {
      execSync(`osascript tools/keynote/extract.scpt "${absolutePath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      return path.join("scripts", basename, "script.json");
    }
  }
}

function runMulmoMovie(mulmoScriptPath: string, outputDir: string): void {
  console.log(`\nGenerating movie with mulmo...`);
  console.log(`  Input: ${mulmoScriptPath}`);
  console.log(`  Output: ${outputDir}`);

  const result = spawnSync("npx", ["mulmo", "movie", "-o", outputDir, mulmoScriptPath], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    throw new Error(`mulmo movie failed with exit code ${result.status}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: yarn movie <presentation-file>");
    console.error("");
    console.error("Supported formats:");
    console.error("  .pptx  - PowerPoint");
    console.error("  .md    - Marp markdown");
    console.error("  .key   - Keynote (macOS only)");
    process.exit(1);
  }

  const inputFile = args[0];

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  try {
    const fileType = detectFileType(inputFile);
    const basename = getBasename(inputFile);
    const outputDir = path.join("output", basename);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 1: Convert to MulmoScript
    const mulmoScriptPath = convertToMulmoScript(inputFile, fileType);

    if (!fs.existsSync(mulmoScriptPath)) {
      throw new Error(`MulmoScript not generated: ${mulmoScriptPath}`);
    }

    console.log(`\n✓ MulmoScript generated: ${mulmoScriptPath}`);

    // Step 2: Run mulmo movie
    runMulmoMovie(mulmoScriptPath, outputDir);

    console.log(`\n✓ Movie generation complete!`);
    console.log(`  Output directory: ${outputDir}`);
  } catch (error) {
    console.error("\n✗ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { convertPptx } from "../pptx/convert";
import { convertMarp } from "../marp/extract";
import { getFileObject, initializeContextFromFiles, audio, images, movie } from "mulmocast";

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

async function convertToMulmoScript(filePath: string, fileType: FileType): Promise<string> {
  const absolutePath = path.resolve(filePath);

  console.log(`Converting ${fileType.toUpperCase()} to MulmoScript...`);

  switch (fileType) {
    case "pptx": {
      const result = await convertPptx({ inputPath: absolutePath });
      return result.mulmoScriptPath;
    }
    case "marp": {
      const result = await convertMarp({ inputPath: absolutePath });
      return result.mulmoScriptPath;
    }
    case "keynote": {
      // Keynote requires AppleScript (shell)
      const basename = getBasename(filePath);
      execSync(`osascript tools/keynote/extract.scpt "${absolutePath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      return path.join("scripts", basename, "script.json");
    }
  }
}

async function runMulmoMovie(mulmoScriptPath: string, outputDir: string): Promise<void> {
  console.log(`\nGenerating movie with mulmo...`);
  console.log(`  Input: ${mulmoScriptPath}`);
  console.log(`  Output: ${outputDir}`);

  const absoluteScriptPath = path.resolve(mulmoScriptPath);
  const scriptDir = path.dirname(absoluteScriptPath);
  const scriptFile = path.basename(absoluteScriptPath);
  const absoluteOutputDir = path.resolve(outputDir);

  // Create FileObject
  const files = getFileObject({
    basedir: scriptDir,
    outdir: absoluteOutputDir,
    file: scriptFile,
  });

  // Initialize context
  const context = await initializeContextFromFiles(files, false, false);
  if (!context) {
    throw new Error("Failed to initialize MulmoStudio context");
  }

  // Generate audio → images → movie (context bucket relay)
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
    const mulmoScriptPath = await convertToMulmoScript(inputFile, fileType);

    if (!fs.existsSync(mulmoScriptPath)) {
      throw new Error(`MulmoScript not generated: ${mulmoScriptPath}`);
    }

    console.log(`\n✓ MulmoScript generated: ${mulmoScriptPath}`);

    // Step 2: Run mulmo movie
    await runMulmoMovie(mulmoScriptPath, outputDir);

    console.log(`\n✓ Movie generation complete!`);
    console.log(`  Output directory: ${outputDir}`);
  } catch (error) {
    console.error("\n✗ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

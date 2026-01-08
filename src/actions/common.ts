import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { convertPptx } from "../pptx/convert";
import { convertMarp } from "../marp/extract";
import { getFileObject, initializeContextFromFiles } from "mulmocast";
import type { MulmoStudioContext } from "mulmocast";

export type FileType = "pptx" | "marp" | "keynote";

export function detectFileType(filePath: string): FileType {
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

export function getBasename(filePath: string): string {
  const ext = path.extname(filePath);
  return path.basename(filePath, ext);
}

export async function convertToMulmoScript(filePath: string, fileType: FileType): Promise<string> {
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
      const basename = getBasename(filePath);
      execSync(`osascript tools/keynote/extract.scpt "${absolutePath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      return path.join("scripts", basename, "mulmo_script.json");
    }
  }
}

export async function initializeContext(
  mulmoScriptPath: string,
  outputDir: string
): Promise<MulmoStudioContext> {
  const absoluteScriptPath = path.resolve(mulmoScriptPath);
  const scriptDir = path.dirname(absoluteScriptPath);
  const scriptFile = path.basename(absoluteScriptPath);
  const absoluteOutputDir = path.resolve(outputDir);

  const files = getFileObject({
    basedir: scriptDir,
    outdir: absoluteOutputDir,
    file: scriptFile,
  });

  const context = await initializeContextFromFiles(files, false, false);
  if (!context) {
    throw new Error("Failed to initialize MulmoStudio context");
  }

  return context;
}

export type ActionRunner = (mulmoScriptPath: string, outputDir: string) => Promise<void>;

export interface RunActionOptions {
  force?: boolean;
}

export function getMulmoScriptPath(basename: string): string {
  return path.join("scripts", basename, "mulmo_script.json");
}

export async function runAction(
  commandName: string,
  inputFile: string,
  actionRunner: ActionRunner,
  options: RunActionOptions = {}
): Promise<void> {
  const { force = false } = options;

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  try {
    const fileType = detectFileType(inputFile);
    const basename = getBasename(inputFile);
    const outputDir = path.join("output", basename);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const mulmoScriptPath = getMulmoScriptPath(basename);

    if (!force && fs.existsSync(mulmoScriptPath)) {
      console.log(`\n✓ Using existing MulmoScript: ${mulmoScriptPath}`);
    } else {
      await convertToMulmoScript(inputFile, fileType);

      if (!fs.existsSync(mulmoScriptPath)) {
        throw new Error(`MulmoScript not generated: ${mulmoScriptPath}`);
      }

      console.log(`\n✓ MulmoScript generated: ${mulmoScriptPath}`);
    }

    await actionRunner(mulmoScriptPath, outputDir);

    console.log(`\n✓ ${commandName} generation complete!`);
    console.log(`  Output directory: ${outputDir}`);
  } catch (error) {
    console.error("\n✗ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}


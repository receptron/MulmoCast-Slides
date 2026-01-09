import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { convertPptx } from "../convert/pptx";
import { convertMarp } from "../convert/marp";
import { convertPdf } from "../convert/pdf";
import { getFileObject, initializeContextFromFiles } from "mulmocast";
import type { MulmoStudioContext } from "mulmocast";
import type { SupportedLang } from "../utils/lang";

// Get package root directory (works for both development and npm installed)
export function getPackageRoot(): string {
  // __dirname points to lib/actions/ when compiled, so go up 2 levels
  return path.resolve(__dirname, "..", "..");
}

// Get path to Keynote AppleScript
export function getKeynoteScriptPath(): string {
  return path.join(getPackageRoot(), "tools", "keynote", "extract.scpt");
}

export type FileType = "pptx" | "marp" | "keynote" | "pdf";

export function detectFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".pptx":
      return "pptx";
    case ".md":
      return "marp";
    case ".key":
      return "keynote";
    case ".pdf":
      return "pdf";
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

export function getBasename(filePath: string): string {
  const ext = path.extname(filePath);
  return path.basename(filePath, ext);
}

export interface ConvertOptions {
  generateText?: boolean;
  lang?: SupportedLang;
}

export async function convertToMulmoScript(
  filePath: string,
  fileType: FileType,
  options: ConvertOptions = {}
): Promise<string> {
  const absolutePath = path.resolve(filePath);
  const { generateText = false, lang } = options;

  console.log(`Converting ${fileType.toUpperCase()} to MulmoScript...`);

  switch (fileType) {
    case "pptx": {
      const result = await convertPptx({ inputPath: absolutePath, generateText, lang });
      return result.mulmoScriptPath;
    }
    case "marp": {
      const result = await convertMarp({ inputPath: absolutePath, generateText, lang });
      return result.mulmoScriptPath;
    }
    case "pdf": {
      const result = await convertPdf({ inputPath: absolutePath, generateText, lang });
      return result.mulmoScriptPath;
    }
    case "keynote": {
      const basename = getBasename(filePath);
      const scriptPath = getKeynoteScriptPath();
      execSync(`osascript "${scriptPath}" "${absolutePath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      return path.join("scripts", basename, "mulmo_script.json");
    }
  }
}

export interface InitializeContextOptions {
  targetLang?: string;
  captionLang?: string;
}

export async function initializeContext(
  mulmoScriptPath: string,
  outputDir: string,
  options: InitializeContextOptions = {}
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

  // targetLang sets context.lang (target language for audio)
  // captionLang sets the caption/subtitle language
  // context.studio.script.lang contains the original script language
  const context = await initializeContextFromFiles(
    files,
    false,
    false,
    true,
    options.captionLang,
    options.targetLang
  );
  if (!context) {
    throw new Error("Failed to initialize MulmoStudio context");
  }

  return context;
}

export type ActionRunner = (mulmoScriptPath: string, outputDir: string) => Promise<void>;

export interface RunActionOptions {
  force?: boolean;
  generateText?: boolean;
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
  const { force = false, generateText = false } = options;

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
      await convertToMulmoScript(inputFile, fileType, { generateText });

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

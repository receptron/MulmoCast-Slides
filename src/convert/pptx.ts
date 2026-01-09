import Converter from "ppt-png";
import PptxParser from "node-pptx-parser";
import * as fs from "fs";
import * as path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { resolveLang, langOption, type SupportedLang } from "../utils/lang";
import { convertPdfToImages, buildMulmoScriptFromImages, writeMulmoScript } from "../utils/pdf";
import { checkDependencies } from "../utils/dependencies";

export interface ConvertPptxOptions {
  inputPath: string;
  outputDir?: string;
  lang?: SupportedLang;
  generateText?: boolean;
}

export interface ConvertPptxResult {
  mulmoScriptPath: string;
  slideCount: number;
}

export async function convertPptx(options: ConvertPptxOptions): Promise<ConvertPptxResult> {
  const { inputPath, lang, generateText = false } = options;
  const pptxFile = path.resolve(inputPath);

  if (!fs.existsSync(pptxFile)) {
    throw new Error(`File not found: ${pptxFile}`);
  }

  // Check for required dependencies
  checkDependencies("pptx");

  const basename = path.basename(pptxFile, ".pptx");
  const outputDir = options.outputDir || path.join("scripts", basename);
  const imagesDir = path.join(outputDir, "images");

  // Create output directories
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Converting ${pptxFile} to ${outputDir}/`);

  // Convert PPTX to PDF (using ppt-png for LibreOffice conversion)
  const converter = Converter.create({
    files: [pptxFile],
    output: outputDir + "/",
    density: 96,
  });

  await converter.convert();

  // Convert PDF to PNG images using shared utility
  const pdfPath = path.join(outputDir, `${basename}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF conversion failed: ${pdfPath} not found`);
  }

  console.log("Re-converting PDF with antialias...");
  const { slideCount } = convertPdfToImages({
    pdfPath,
    imagesDir,
    basename,
  });

  // Extract text from PPTX
  const parser = new PptxParser(pptxFile);
  const textContent = await parser.extractText();
  const slideTexts = textContent.map((slide: { text: string[] }) => slide.text.join("\n"));

  // Resolve language (with auto-detection from extracted text)
  const resolvedLang = resolveLang(lang, slideTexts);

  // Build MulmoScript using shared utility
  // Pass slideTexts as both default text and extracted text for LLM
  const { mulmoScript } = await buildMulmoScriptFromImages({
    slideCount,
    imagesDir,
    basename,
    lang: resolvedLang,
    slideTexts,
    extractedTexts: slideTexts,
    generateText,
    title: basename,
  });

  // Write MulmoScript to JSON file
  const jsonPath = path.join(outputDir, "mulmo_script.json");
  writeMulmoScript(mulmoScript, jsonPath);

  return {
    mulmoScriptPath: jsonPath,
    slideCount,
  };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: $0 <pptx-file> [options]")
    .command("$0 <file>", "Convert PPTX to MulmoScript", (yargs) => {
      return yargs.positional("file", {
        describe: "PPTX file to convert",
        type: "string",
        demandOption: true,
      });
    })
    .options({
      ...langOption,
      g: {
        alias: "generate-text",
        type: "boolean",
        description: "Generate narration text using LLM",
        default: false,
      },
    })
    .help()
    .parse();

  await convertPptx({
    inputPath: argv.file as string,
    lang: argv.l as SupportedLang | undefined,
    generateText: argv.g,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
}

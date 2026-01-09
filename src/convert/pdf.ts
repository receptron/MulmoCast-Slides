#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { resolveLang, langOption, type SupportedLang } from "../utils/lang";
import {
  convertPdfToImages,
  buildMulmoScriptFromImages,
  writeMulmoScript,
  extractTextFromPdf,
} from "../utils/pdf";
import { checkDependencies } from "../utils/dependencies";

export interface ConvertPdfOptions {
  inputPath: string;
  outputDir?: string;
  lang?: SupportedLang;
  generateText?: boolean;
}

export interface ConvertPdfResult {
  mulmoScriptPath: string;
  slideCount: number;
}

export async function convertPdf(options: ConvertPdfOptions): Promise<ConvertPdfResult> {
  const { inputPath, lang, generateText = false } = options;
  const pdfFile = path.resolve(inputPath);

  if (!fs.existsSync(pdfFile)) {
    throw new Error(`File not found: ${pdfFile}`);
  }

  // Check for required dependencies
  checkDependencies("pdf");

  const basename = path.basename(pdfFile, ".pdf");
  const outputDir = options.outputDir || path.join("scripts", basename);
  const imagesDir = path.join(outputDir, "images");

  // Create output directories
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Converting ${pdfFile} to ${outputDir}/`);

  // Convert PDF to PNG images
  console.log("Converting PDF to images...");
  const { slideCount } = convertPdfToImages({
    pdfPath: pdfFile,
    imagesDir,
    basename,
  });

  // Extract text from PDF for language detection and narration generation
  console.log("Extracting text from PDF...");
  const pageTexts = await extractTextFromPdf(pdfFile);
  const extractedTexts: string[] = [];
  pageTexts.forEach((page) => {
    extractedTexts[page.pageNumber] = page.text;
  });
  console.log(`Extracted text from ${pageTexts.length} pages`);

  // Resolve language (with auto-detection from extracted text)
  const resolvedLang = resolveLang(lang, extractedTexts.filter(Boolean));

  // Build MulmoScript
  const { mulmoScript } = await buildMulmoScriptFromImages({
    slideCount,
    imagesDir,
    basename,
    lang: resolvedLang,
    extractedTexts,
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
    .usage("Usage: $0 <pdf-file> [options]")
    .command("$0 <file>", "Convert PDF to MulmoScript", (yargs) => {
      return yargs.positional("file", {
        describe: "PDF file to convert",
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

  await convertPdf({
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

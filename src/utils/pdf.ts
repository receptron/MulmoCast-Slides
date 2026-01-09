import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { mulmoScriptSchema, type MulmoBeat } from "mulmocast";
import type { z } from "zod";
import type { SupportedLang } from "./lang";
import { generateTextFromImages } from "./llm";

type MulmoScriptInput = z.input<typeof mulmoScriptSchema>;
type MulmoScriptOutput = z.output<typeof mulmoScriptSchema>;

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
}

export async function extractTextFromPdf(pdfPath: string): Promise<ExtractedPageText[]> {
  const { PDFParse } = await import("pdf-parse");

  const dataBuffer = fs.readFileSync(pdfPath);
  const uint8Array = new Uint8Array(dataBuffer);

  const parser = new PDFParse(uint8Array);
  await parser.load();
  const textResult = await parser.getText();

  // textResult.pages is an array of { text: string, num: number }
  return textResult.pages.map((page: { text: string; num: number }) => ({
    pageNumber: page.num - 1, // Convert to 0-based index
    text: page.text.trim(),
  }));
}

export interface PdfToImagesOptions {
  pdfPath: string;
  imagesDir: string;
  basename: string;
}

export interface PdfToImagesResult {
  imageFiles: string[];
  slideCount: number;
}

export function convertPdfToImages(options: PdfToImagesOptions): PdfToImagesResult {
  const { pdfPath, imagesDir, basename } = options;

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  // Create images directory if it doesn't exist
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // Delete old PNGs from images directory
  const oldPngs = fs.readdirSync(imagesDir).filter((f) => f.endsWith(".png"));
  oldPngs.forEach((f) => fs.unlinkSync(path.join(imagesDir, f)));

  // Convert with ImageMagick (better antialias) to images/ directory
  // Use 'magick' on macOS/Windows (ImageMagick 7), 'convert' on Linux (ImageMagick 6)
  const magickCmd = process.platform === "linux" ? "convert" : "magick";
  execSync(
    `${magickCmd} -density 300 -antialias "${pdfPath}" -background white -alpha remove -quality 95 "${imagesDir}/${basename}-%d.png"`,
    { stdio: "inherit" }
  );

  // Count generated images
  const imageFiles = fs
    .readdirSync(imagesDir)
    .filter((f) => f.startsWith(`${basename}-`) && f.endsWith(".png"))
    .sort();

  return {
    imageFiles,
    slideCount: imageFiles.length,
  };
}

export interface BuildMulmoScriptOptions {
  slideCount: number;
  imagesDir: string;
  basename: string;
  lang: SupportedLang;
  slideTexts?: string[];
  extractedTexts?: string[];
  generateText?: boolean;
  title?: string;
}

export interface BuildMulmoScriptResult {
  mulmoScript: MulmoScriptOutput;
  beats: MulmoBeat[];
}

export async function buildMulmoScriptFromImages(
  options: BuildMulmoScriptOptions
): Promise<BuildMulmoScriptResult> {
  const {
    slideCount,
    imagesDir,
    basename,
    lang,
    slideTexts = [],
    extractedTexts = [],
    generateText = false,
    title,
  } = options;

  const beats: MulmoBeat[] = Array.from({ length: slideCount }, (_, index) => {
    const imagePath = `./images/${basename}-${index}.png`;
    const text = slideTexts[index] || "";

    return {
      text,
      image: {
        type: "image",
        source: {
          kind: "path",
          path: imagePath,
        },
      },
    };
  });

  // Generate text using LLM if requested
  if (generateText) {
    console.log("Generating narration text with LLM...");
    const slides = beats.map((_, index) => ({
      index,
      imagePath: path.join(imagesDir, `${basename}-${index}.png`),
      existingText: "",
      extractedText: extractedTexts[index] || "",
    }));

    const generatedTexts = await generateTextFromImages({
      slides,
      lang,
      title: title || basename,
    });

    generatedTexts.forEach((generated) => {
      if (beats[generated.index]) {
        beats[generated.index].text = generated.text;
      }
    });
    console.log(`Generated text for ${generatedTexts.length} slides`);
  }

  const mulmoScript: MulmoScriptInput = {
    $mulmocast: {
      version: "1.1",
    },
    lang,
    beats,
  };

  // Validate mulmoScript
  const result = mulmoScriptSchema.safeParse(mulmoScript);
  if (!result.success) {
    console.error("MulmoScript validation failed:");
    console.error(result.error.format());
    throw new Error("Invalid MulmoScript generated");
  }

  return { mulmoScript: result.data, beats };
}

export function writeMulmoScript(mulmoScript: MulmoScriptOutput, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(mulmoScript, null, 2));
  console.log(`Generated: ${outputPath}`);
  console.log(`Total slides: ${mulmoScript.beats.length}`);
}

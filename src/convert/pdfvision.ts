import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { mulmoScriptSchema } from "mulmocast";
import type { z } from "zod";
import { resolveLang, type SupportedLang } from "../utils/lang.js";
import { convertPdfToImages, extractTextFromPdf, writeMulmoScript } from "../utils/pdf.js";
import { checkDependencies } from "../utils/dependencies.js";
import {
  resolveVisionProvider,
  callVisionAPI,
  callTextLLM,
  type VisionProvider,
  type VisionImage,
} from "../utils/vision-provider.js";
import {
  buildDocumentAnalysisPrompt,
  parseDocumentAnalysis,
  type DocumentAnalysis,
  type FigureInfo,
} from "../utils/document-analysis.js";
import { buildNarrationPrompt, parseNarrationResponse } from "../utils/narration-generator.js";

type MulmoScriptInput = z.input<typeof mulmoScriptSchema>;

const CROP_PADDING_PERCENT = 5;
const CROP_DPI = 600;
const TRIM_BORDER_PX = 20;

export interface ConvertPdfVisionOptions {
  inputPath: string;
  lang?: SupportedLang;
  provider?: string;
}

export interface ConvertPdfVisionResult {
  mulmoScriptPath: string;
  extractedTextsPath: string | null;
  analysisPath: string;
  slideCount: number;
}

const getMagickCmd = (): string => {
  return process.platform === "linux" ? "convert" : "magick";
};

const buildPageImages = (imagesDir: string, basename: string, pageCount: number): VisionImage[] => {
  return Array.from({ length: pageCount }, (_, i) => ({
    path: path.join(imagesDir, `${basename}-${i}.png`),
  })).filter((img) => fs.existsSync(img.path));
};

const sanitizeLabel = (label: string): string => {
  return label.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
};

const getImageDimensions = (imagePath: string): { width: number; height: number } | null => {
  try {
    const magick = getMagickCmd();
    const identifyCmd = magick === "magick" ? "magick identify" : "identify";
    const output = execSync(`${identifyCmd} -format "%w %h" "${imagePath}"`, { encoding: "utf-8" });
    const [w, h] = output.trim().split(" ").map(Number);
    return { width: w, height: h };
  } catch {
    return null;
  }
};

const convertPageHighRes = (pdfPath: string, page: number, outputPath: string): boolean => {
  try {
    const magick = getMagickCmd();
    const cmd = `${magick} -density ${CROP_DPI} -antialias "${pdfPath}[${page}]" -background white -alpha remove -quality 95 "${outputPath}"`;
    execSync(cmd, { stdio: "pipe" });
    return fs.existsSync(outputPath);
  } catch {
    return false;
  }
};

const addPadding = (
  bbox: { x: number; y: number; width: number; height: number },
  padding: number
): { x: number; y: number; width: number; height: number } => {
  const x = Math.max(0, bbox.x - padding);
  const y = Math.max(0, bbox.y - padding);
  const width = Math.min(100 - x, bbox.width + padding * 2);
  const height = Math.min(100 - y, bbox.height + padding * 2);
  return { x, y, width, height };
};

const cropFigure = (
  pageImagePath: string,
  outputPath: string,
  bbox: { x: number; y: number; width: number; height: number }
): boolean => {
  try {
    const dims = getImageDimensions(pageImagePath);
    if (!dims) return false;

    const padded = addPadding(bbox, CROP_PADDING_PERCENT);

    const cropX = Math.round((padded.x / 100) * dims.width);
    const cropY = Math.round((padded.y / 100) * dims.height);
    const cropW = Math.round((padded.width / 100) * dims.width);
    const cropH = Math.round((padded.height / 100) * dims.height);

    const magick = getMagickCmd();
    const cropCmd = [
      `${magick} "${pageImagePath}"`,
      `-crop ${cropW}x${cropH}+${cropX}+${cropY} +repage`,
      `-trim +repage`,
      `-bordercolor white -border ${TRIM_BORDER_PX}`,
      `"${outputPath}"`,
    ].join(" ");
    execSync(cropCmd, { stdio: "pipe" });
    return fs.existsSync(outputPath);
  } catch {
    return false;
  }
};

const cropFigures = (
  analysis: DocumentAnalysis,
  imagesDir: string,
  basename: string,
  pdfPath: string
): Map<string, string> => {
  const figureImageMap = new Map<string, string>();

  // Identify pages that need high-res conversion
  const pagesWithFigures = new Set<number>();
  analysis.figures.forEach((figure: FigureInfo) => {
    if (figure.bbox && figure.label) {
      pagesWithFigures.add(figure.page);
    }
  });

  // Convert those pages at high DPI
  const highResDir = path.join(imagesDir, "_highres");
  if (pagesWithFigures.size > 0) {
    if (!fs.existsSync(highResDir)) {
      fs.mkdirSync(highResDir, { recursive: true });
    }
  }

  const highResMap = new Map<number, string>();
  pagesWithFigures.forEach((page) => {
    const highResPath = path.join(highResDir, `${basename}-${page}-hires.png`);
    if (convertPageHighRes(pdfPath, page, highResPath)) {
      highResMap.set(page, highResPath);
      console.log(`  High-res (${CROP_DPI}dpi): page ${page}`);
    }
  });

  // Crop figures from high-res images (fallback to standard images)
  analysis.figures.forEach((figure: FigureInfo) => {
    if (!figure.bbox || !figure.label) return;

    const sourceImage =
      highResMap.get(figure.page) ?? path.join(imagesDir, `${basename}-${figure.page}.png`);
    if (!fs.existsSync(sourceImage)) return;

    const sanitized = sanitizeLabel(figure.label);
    const croppedFilename = `${basename}-fig-${sanitized}.png`;
    const croppedPath = path.join(imagesDir, croppedFilename);

    if (cropFigure(sourceImage, croppedPath, figure.bbox)) {
      figureImageMap.set(figure.label, `./images/${croppedFilename}`);
      console.log(`  Cropped: ${figure.label} → ${croppedFilename}`);
    }
  });

  // Clean up high-res temp images
  if (fs.existsSync(highResDir)) {
    fs.readdirSync(highResDir).forEach((f) => fs.unlinkSync(path.join(highResDir, f)));
    fs.rmdirSync(highResDir);
  }

  return figureImageMap;
};

const analyzeDocument = async (
  provider: VisionProvider,
  images: VisionImage[],
  extractedTexts: string[],
  lang: SupportedLang
): Promise<DocumentAnalysis> => {
  console.log(`Analyzing document with ${provider} Vision API...`);

  const prompt = buildDocumentAnalysisPrompt({
    pageCount: images.length,
    extractedTexts,
    lang,
  });

  const response = await callVisionAPI(provider, { prompt, images });
  return parseDocumentAnalysis(response);
};

const generateNarrations = async (
  provider: VisionProvider,
  analysis: DocumentAnalysis,
  extractedTexts: string[],
  lang: SupportedLang
): Promise<string[]> => {
  console.log("Generating narration with text LLM...");

  const prompt = buildNarrationPrompt({
    documentAnalysis: analysis,
    extractedTexts,
    lang,
  });

  const response = await callTextLLM(provider, prompt);
  const entries = parseNarrationResponse(response, analysis.slides.length);
  return entries.map((e) => e.text);
};

const buildMulmoScript = (
  analysis: DocumentAnalysis,
  narrations: string[],
  basename: string,
  lang: SupportedLang,
  figureImageMap: Map<string, string>
): z.output<typeof mulmoScriptSchema> => {
  const beats = analysis.slides.map((slide, i) => {
    const imagePage = slide.imagePage ?? slide.sourcePages[0] ?? 0;
    const pageImagePath = `./images/${basename}-${imagePage}.png`;
    const imagePath =
      slide.figureRef && figureImageMap.has(slide.figureRef)
        ? figureImageMap.get(slide.figureRef)!
        : pageImagePath;

    return {
      text: narrations[i] || "",
      image: {
        type: "image" as const,
        source: {
          kind: "path" as const,
          path: imagePath,
        },
      },
    };
  });

  const mulmoScript: MulmoScriptInput = {
    $mulmocast: { version: "1.1" },
    lang,
    beats,
  };

  const result = mulmoScriptSchema.safeParse(mulmoScript);
  if (!result.success) {
    console.error("MulmoScript validation failed:");
    console.error(result.error.format());
    throw new Error("Invalid MulmoScript generated");
  }

  return result.data;
};

export const convertPdfVision = async (
  options: ConvertPdfVisionOptions
): Promise<ConvertPdfVisionResult> => {
  const { inputPath, provider: providerArg } = options;
  const pdfFile = path.resolve(inputPath);

  if (!fs.existsSync(pdfFile)) {
    throw new Error(`File not found: ${pdfFile}`);
  }

  checkDependencies("pdf");

  const provider = resolveVisionProvider(providerArg);
  console.log(`Using Vision provider: ${provider}`);

  const basename = path.basename(pdfFile, ".pdf");
  const outputDir = path.join("scripts", basename);
  const imagesDir = path.join(outputDir, "images");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Step 1: Convert PDF to page images
  console.log("Converting PDF to images...");
  const { slideCount: pageCount } = convertPdfToImages({
    pdfPath: pdfFile,
    imagesDir,
    basename,
  });

  // Step 2: Extract text
  console.log("Extracting text from PDF...");
  const pageTexts = await extractTextFromPdf(pdfFile);
  const extractedTexts: string[] = [];
  pageTexts.forEach((page) => {
    extractedTexts[page.pageNumber] = page.text;
  });
  console.log(`Extracted text from ${pageTexts.length} pages`);

  const resolvedLang = resolveLang(options.lang, extractedTexts.filter(Boolean));

  // Save extracted texts
  const hasExtractedText = extractedTexts.some((t) => t && t.length > 0);
  let extractedTextsPath: string | null = null;
  if (hasExtractedText) {
    extractedTextsPath = path.join(outputDir, "extracted_texts.json");
    fs.writeFileSync(extractedTextsPath, JSON.stringify(extractedTexts, null, 2));
  }

  // Step 3: Vision API - analyze document (1 API call)
  const images = buildPageImages(imagesDir, basename, pageCount);
  const analysis = await analyzeDocument(provider, images, extractedTexts, resolvedLang);

  // Save analysis
  const analysisPath = path.join(outputDir, "analysis.json");
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`Document analysis saved: ${analysisPath}`);
  console.log(`  Sections: ${analysis.sections.length}`);
  console.log(`  Figures: ${analysis.figures.length}`);
  console.log(`  Planned slides: ${analysis.slides.length}`);

  // Step 4: Crop figures from high-res page images
  console.log("Cropping figures from page images...");
  const figureImageMap = cropFigures(analysis, imagesDir, basename, pdfFile);
  console.log(`  Cropped ${figureImageMap.size} figures`);

  // Step 5: Text LLM - generate narration (1 API call)
  const narrations = await generateNarrations(provider, analysis, extractedTexts, resolvedLang);

  // Step 6: Build and write MulmoScript
  const mulmoScript = buildMulmoScript(
    analysis,
    narrations,
    basename,
    resolvedLang,
    figureImageMap
  );
  const jsonPath = path.join(outputDir, `${basename}.json`);
  writeMulmoScript(mulmoScript, jsonPath);

  console.log(`\n✓ pdfvision conversion complete!`);
  console.log(`  Provider: ${provider}`);
  console.log(`  Pages: ${pageCount} → Slides: ${analysis.slides.length}`);
  console.log(`  Output: ${jsonPath}`);

  return {
    mulmoScriptPath: jsonPath,
    extractedTextsPath,
    analysisPath,
    slideCount: analysis.slides.length,
  };
};

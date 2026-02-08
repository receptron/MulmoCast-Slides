import * as fs from "fs";
import * as path from "path";
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
} from "../utils/document-analysis.js";
import { buildNarrationPrompt, parseNarrationResponse } from "../utils/narration-generator.js";

type MulmoScriptInput = z.input<typeof mulmoScriptSchema>;

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

const buildPageImages = (imagesDir: string, basename: string, pageCount: number): VisionImage[] => {
  return Array.from({ length: pageCount }, (_, i) => ({
    path: path.join(imagesDir, `${basename}-${i}.png`),
  })).filter((img) => fs.existsSync(img.path));
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
  lang: SupportedLang
): z.output<typeof mulmoScriptSchema> => {
  const beats = analysis.slides.map((slide, i) => {
    const imagePage = slide.imagePage ?? slide.sourcePages[0] ?? 0;
    const imagePath = `./images/${basename}-${imagePage}.png`;

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

  // Step 4: Text LLM - generate narration (1 API call)
  const narrations = await generateNarrations(provider, analysis, extractedTexts, resolvedLang);

  // Step 5: Build and write MulmoScript
  const mulmoScript = buildMulmoScript(analysis, narrations, basename, resolvedLang);
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

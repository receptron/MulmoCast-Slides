import Converter from "ppt-png";
import PptxParser from "node-pptx-parser";
import * as fs from "fs";
import * as path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { resolveLang, langOption, type SupportedLang } from "../utils/lang";
import { convertPdfToImages, buildMulmoScriptFromImages, writeMulmoScript } from "../utils/pdf";
import { checkDependencies } from "../utils/dependencies";
import unzipper from "unzipper";
import { parseString } from "xml2js";

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

/**
 * Get the correct slide order from presentation.xml
 * Returns an array of slide IDs in presentation order
 */
async function getSlideOrder(pptxFile: string): Promise<number[]> {
  const directory = await (unzipper as any).Open.file(pptxFile);

  const presentationFile = directory.files.find((f: any) => f.path === "ppt/presentation.xml");
  if (!presentationFile) {
    throw new Error("presentation.xml not found");
  }

  const content = await presentationFile.buffer();
  const xmlContent = content.toString("utf-8");

  return new Promise<number[]>((resolve, reject) => {
    (parseString as any)(xmlContent, (err: any, result: any) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const slideIdList = result?.["p:presentation"]?.["p:sldIdLst"]?.[0]?.["p:sldId"] || [];
        const slideOrder: number[] = [];

        for (const slideId of slideIdList) {
          const rId = slideId.$["r:id"];
          // rId format is like "rId2", extract the number
          const idNum = parseInt(rId.replace(/\D/g, ""));
          slideOrder.push(idNum);
        }

        resolve(slideOrder);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Map relationship IDs to slide numbers
 * Returns a map of rId number -> slide number
 */
async function getSlideIdMap(pptxFile: string): Promise<{ [rId: number]: number }> {
  const directory = await (unzipper as any).Open.file(pptxFile);

  const relsFile = directory.files.find((f: any) => f.path === "ppt/_rels/presentation.xml.rels");
  if (!relsFile) {
    throw new Error("presentation.xml.rels not found");
  }

  const content = await relsFile.buffer();
  const xmlContent = content.toString("utf-8");

  return new Promise<{ [rId: number]: number }>((resolve, reject) => {
    (parseString as any)(xmlContent, (err: any, result: any) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const relationships = result?.Relationships?.Relationship || [];
        const idMap: { [rId: number]: number } = {};

        for (const rel of relationships) {
          const rId = rel.$?.Id;
          const target = rel.$?.Target;

          if (target && target.includes("slides/slide")) {
            const slideNum = parseInt(target.match(/slide(\d+)\.xml$/)?.[1] || "0");
            const idNum = parseInt(rId.replace(/\D/g, ""));
            idMap[idNum] = slideNum;
          }
        }

        resolve(idMap);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Extract speaker notes from PPTX file with correct slide mapping
 * PPTX files contain speaker notes in ppt/notesSlides/notesSlide*.xml
 * The mapping between slides and notesSlides is in ppt/slides/_rels/slide*.xml.rels
 */
async function extractSpeakerNotes(pptxFile: string, slideOrder: number[]): Promise<string[]> {
  const directory = await (unzipper as any).Open.file(pptxFile);

  // Build a map of slideN -> notesSlideN by reading relationship files
  const slideToNotesMap: { [slideIndex: number]: number } = {};

  // Find all slide relationship files
  const slideRelsFiles = directory.files.filter((f: any) =>
    f.path.match(/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/)
  );

  for (const relsFile of slideRelsFiles) {
    const slideNum = parseInt(relsFile.path.match(/slide(\d+)\.xml\.rels$/)?.[1] || "0");
    const content = await relsFile.buffer();
    const xmlContent = content.toString("utf-8");

    // Parse the rels file to find notesSlide reference
    await new Promise<void>((resolve) => {
      (parseString as any)(xmlContent, (err: any, result: any) => {
        if (err) {
          resolve();
          return;
        }

        try {
          const relationships = result?.Relationships?.Relationship || [];
          for (const rel of relationships) {
            const target = rel.$?.Target;
            if (target && target.includes("notesSlide")) {
              const notesNum = parseInt(target.match(/notesSlide(\d+)\.xml$/)?.[1] || "0");
              slideToNotesMap[slideNum] = notesNum;
              break;
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }

        resolve();
      });
    });
  }

  // Extract notes content from notesSlide files
  const notesContentMap: { [notesNum: number]: string } = {};

  const notesFiles = directory.files.filter((f: any) =>
    f.path.match(/^ppt\/notesSlides\/notesSlide\d+\.xml$/)
  );

  for (const file of notesFiles) {
    const notesNum = parseInt(file.path.match(/notesSlide(\d+)\.xml$/)?.[1] || "0");
    const content = await file.buffer();
    const xmlContent = content.toString("utf-8");

    const texts: string[] = [];
    await new Promise<void>((resolve, reject) => {
      (parseString as any)(xmlContent, (err: any, result: any) => {
        if (err) {
          reject(err);
          return;
        }

        // Navigate through the XML structure to find text content
        // Only extract text from shapes with placeholder type "body" (speaker notes)
        try {
          const cSld = result?.["p:notes"]?.["p:cSld"]?.[0];
          const spTree = cSld?.["p:spTree"]?.[0];
          const shapes = spTree?.["p:sp"] || [];

          for (const shape of shapes) {
            const nvSpPr = shape["p:nvSpPr"]?.[0];
            const nvPr = nvSpPr?.["p:nvPr"]?.[0];
            const ph = nvPr?.["p:ph"]?.[0];
            const phType = ph?.$?.type;

            if (phType !== "body") continue;

            const txBody = shape["p:txBody"]?.[0];
            if (!txBody) continue;

            const paragraphs = txBody["a:p"] || [];
            for (const para of paragraphs) {
              const runs = para["a:r"] || [];
              for (const run of runs) {
                const textNodes = run["a:t"] || [];
                for (const textNode of textNodes) {
                  if (typeof textNode === "string") {
                    texts.push(textNode);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to parse notes from ${file.path}:`, e);
        }

        resolve();
      });
    });

    notesContentMap[notesNum] = texts.join("\n");
  }

  // Build final notes array aligned with slide order
  const notes: string[] = [];
  for (const slideNum of slideOrder) {
    const notesNum = slideToNotesMap[slideNum];
    if (notesNum && notesContentMap[notesNum]) {
      notes.push(notesContentMap[notesNum]);
    } else {
      notes.push(""); // No speaker notes for this slide
    }
  }

  return notes;
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

  // Get presentation order first
  const presentationOrder = await getSlideOrder(pptxFile);
  const slideIdMap = await getSlideIdMap(pptxFile);
  const slideOrder = presentationOrder.map((rId) => slideIdMap[rId]);

  // Extract text from PPTX
  const parser = new PptxParser(pptxFile);
  const textContent = await parser.extractText();

  // Build a map of rId -> text
  // node-pptx-parser returns slides with id (rId) and path fields
  const rIdToTextMap: { [rId: string]: string } = {};
  textContent.forEach((slide: any) => {
    const rIdNum = parseInt(slide.id.replace(/\D/g, ""));
    rIdToTextMap[rIdNum] = slide.text.join("\n");
  });

  // Now map presentation order to texts
  // presentationOrder contains rIds in presentation order
  const orderedSlideTexts = presentationOrder.map((rId) => rIdToTextMap[rId] || "");

  // Extract speaker notes from PPTX with correct order
  const speakerNotes = await extractSpeakerNotes(pptxFile, slideOrder);

  // Use speaker notes if available, otherwise fall back to slide text
  const finalTexts = speakerNotes.map((note, index) => {
    // If speaker note exists and is not empty, use it; otherwise use slide text
    return note.trim() ? note : orderedSlideTexts[index] || "";
  });

  // Ensure we have enough texts for all slides
  while (finalTexts.length < slideCount) {
    finalTexts.push(orderedSlideTexts[finalTexts.length] || "");
  }

  // Resolve language (with auto-detection from extracted text)
  const resolvedLang = resolveLang(lang, finalTexts);

  // Build MulmoScript using shared utility
  // Pass finalTexts (speaker notes or slide text) as slideTexts
  const { mulmoScript } = await buildMulmoScriptFromImages({
    slideCount,
    imagesDir,
    basename,
    lang: resolvedLang,
    slideTexts: finalTexts,
    extractedTexts: orderedSlideTexts,
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

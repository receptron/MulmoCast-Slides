import Converter from "ppt-png";
import PptxParser from "node-pptx-parser";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { mulmoScriptSchema, type MulmoScript, type MulmoBeat } from "mulmocast";

export interface ConvertPptxOptions {
  inputPath: string;
  outputDir?: string;
}

export interface ConvertPptxResult {
  mulmoScriptPath: string;
  slideCount: number;
}

export async function convertPptx(options: ConvertPptxOptions): Promise<ConvertPptxResult> {
  const { inputPath } = options;
  const pptxFile = path.resolve(inputPath);

  if (!fs.existsSync(pptxFile)) {
    throw new Error(`File not found: ${pptxFile}`);
  }

  const basename = path.basename(pptxFile, ".pptx");
  const outputDir = options.outputDir || path.join("scripts", basename);
  const imagesDir = path.join(outputDir, "images");

  // Create output directories
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  console.log(`Converting ${pptxFile} to ${outputDir}/`);

  // Convert PPTX to PDF (using ppt-png for LibreOffice conversion)
  const converter = Converter.create({
    files: [pptxFile],
    output: outputDir + "/",
    density: 96,
  });

  await converter.convert();

  // Re-convert PDF to PNG with better antialias using ImageMagick
  const pdfPath = path.join(outputDir, `${basename}.pdf`);
  if (fs.existsSync(pdfPath)) {
    console.log("Re-converting PDF with antialias...");
    // Delete old PNGs from images directory
    if (fs.existsSync(imagesDir)) {
      const oldPngs = fs.readdirSync(imagesDir).filter((f) => f.endsWith(".png"));
      oldPngs.forEach((f) => fs.unlinkSync(path.join(imagesDir, f)));
    }

    // Convert with ImageMagick (better antialias) to images/ directory
    execSync(
      `magick -density 300 -antialias "${pdfPath}" -background white -alpha remove -quality 95 "${imagesDir}/${basename}-%d.png"`,
      { stdio: "inherit" }
    );
  }

  // Extract text from PPTX
  const parser = new PptxParser(pptxFile);
  const textContent = await parser.extractText();

  // Build mulmoScript
  const beats: MulmoBeat[] = [];
  const mulmoScript: MulmoScript = {
    $mulmocast: {
      version: "1.1",
    },
    beats,
  };

  textContent.forEach((slide: { id: number; text: string[] }, index: number) => {
    const imagePath = `./images/${basename}-${index}.png`;
    const text = slide.text.join("\n");

    const beat: MulmoBeat = {
      id: String(slide.id),
      speaker: "Presenter",
      text: text,
      image: {
        type: "image",
        source: {
          kind: "path",
          path: imagePath,
        },
      },
    };
    beats.push(beat);
  });

  // Validate mulmoScript
  const result = mulmoScriptSchema.safeParse(mulmoScript);
  if (!result.success) {
    console.error("MulmoScript validation failed:");
    console.error(result.error.format());
    throw new Error("Invalid MulmoScript generated");
  }

  // Write mulmoScript to JSON file
  const jsonPath = path.join(outputDir, "mulmo_script.json");
  fs.writeFileSync(jsonPath, JSON.stringify(mulmoScript, null, 2));

  console.log(`Generated: ${jsonPath}`);
  console.log(`Total slides: ${mulmoScript.beats.length}`);

  return {
    mulmoScriptPath: jsonPath,
    slideCount: mulmoScript.beats.length,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx convert.ts <pptx-file>");
    process.exit(1);
  }

  await convertPptx({ inputPath: args[0] });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
}

import Converter from "ppt-png";
import PptxParser from "node-pptx-parser";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx convert.ts <pptx-file>");
    process.exit(1);
  }

  const pptxFile = args[0];
  if (!fs.existsSync(pptxFile)) {
    console.error(`File not found: ${pptxFile}`);
    process.exit(1);
  }

  const basename = path.basename(pptxFile, ".pptx");
  const outputDir = basename;

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Converting ${pptxFile} to ${outputDir}/`);

  // Convert PPTX to PDF (using ppt-png for LibreOffice conversion)
  const converter = Converter.create({
    files: [pptxFile],
    output: outputDir + "/",
    density: 96, // ppt-pngのデフォルト（後でImageMagickで再変換）
  });

  await converter.convert();

  // Re-convert PDF to PNG with better antialias using ImageMagick
  const pdfPath = path.join(outputDir, `${basename}.pdf`);
  if (fs.existsSync(pdfPath)) {
    console.log("Re-converting PDF with antialias...");
    // Delete old PNGs
    const oldPngs = fs.readdirSync(outputDir).filter((f) => f.endsWith(".png"));
    oldPngs.forEach((f) => fs.unlinkSync(path.join(outputDir, f)));

    // Convert with ImageMagick (better antialias)
    execSync(
      `magick -density 300 -antialias "${pdfPath}" -background white -alpha remove -quality 95 "${outputDir}/${basename}-%d.png"`,
      { stdio: "inherit" }
    );
  }

  // Extract text from PPTX
  const parser = new PptxParser(pptxFile);
  const textContent = await parser.extractText();

  // Build mulmoScript
  const mulmoScript: {
    $mulmocast: { version: string };
    beats: Array<{
      id: string;
      speaker: string;
      text: string;
      image: {
        type: string;
        source: {
          kind: string;
          path: string;
        };
      };
    }>;
  } = {
    $mulmocast: {
      version: "1.1",
    },
    beats: [],
  };

  textContent.forEach((slide: { id: number; text: string[] }, index: number) => {
    const imagePath = `./${basename}-${index}.png`;
    const text = slide.text.join("\n");

    mulmoScript.beats.push({
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
    });
  });

  // Write mulmoScript to JSON file
  const jsonPath = path.join(outputDir, "mulmoScript.json");
  fs.writeFileSync(jsonPath, JSON.stringify(mulmoScript, null, 2));

  console.log(`Generated: ${jsonPath}`);
  console.log(`Total slides: ${mulmoScript.beats.length}`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});

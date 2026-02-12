import * as fs from "fs";
import * as path from "path";
import { extendedMulmoScriptSchema } from "@mulmocast/extended-types";
import type { ExtendedMulmoScript } from "@mulmocast/extended-types";
import type { MulmoScript } from "@mulmocast/types";
import {
  detectFileType,
  getBasename,
  convertToMulmoScript,
  getMulmoScriptPath,
  readJsonFile,
  writeJsonFile,
  loadExtractedTexts,
  formatZodError,
} from "./common.js";
import { scaffoldExtendedMulmoScript } from "./extend-scaffold.js";
import { convertMarkdown } from "../convert/markdown.js";
import type { SupportedLang } from "../utils/lang.js";
import type { SeparatorMode } from "../convert/markdown-plugins/index.js";
import type { BeatInput, MetadataResult } from "../utils/llm-metadata.js";

export interface NarrateOptions {
  lang?: SupportedLang;
  scaffoldOnly?: boolean;
  force?: boolean;
  separator?: string;
  mermaid?: boolean;
}

const isMarkdownFile = (filePath: string): boolean => {
  return path.extname(filePath).toLowerCase() === ".md";
};

const convertSourceToMulmoScript = async (
  filePath: string,
  options: NarrateOptions
): Promise<string> => {
  const absolutePath = path.resolve(filePath);

  if (isMarkdownFile(filePath)) {
    const result = await convertMarkdown({
      inputPath: absolutePath,
      lang: options.lang,
      generateText: false,
      separator: (options.separator as SeparatorMode) ?? "horizontal-rule",
      mermaid: options.mermaid,
    });
    return result.mulmoScriptPath;
  }

  const fileType = detectFileType(filePath);
  return convertToMulmoScript(absolutePath, fileType, {
    generateText: false,
    lang: options.lang,
  });
};

const loadSourceContent = (filePath: string): string | undefined => {
  if (isMarkdownFile(filePath) && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  return undefined;
};

const buildBeatInputs = (
  mulmoScript: MulmoScript,
  extractedTexts: string[] | null
): BeatInput[] => {
  return mulmoScript.beats.map((beat, i) => {
    const input: BeatInput = {
      index: i,
      text: beat.text,
    };

    // Markdown content
    if (beat.image?.type === "markdown") {
      const md = beat.image.markdown;
      if (Array.isArray(md)) {
        input.markdown = md as string[];
      }
    }

    // Image path
    if (beat.image?.type === "image" && beat.image.source.kind === "path") {
      input.imagePath = beat.image.source.path;
    }

    // Extracted text
    if (extractedTexts && i < extractedTexts.length && extractedTexts[i]) {
      input.extractedText = extractedTexts[i];
    }

    return input;
  });
};

const applyLLMResults = (
  scaffolded: ExtendedMulmoScript,
  llmResult: MetadataResult
): ExtendedMulmoScript => {
  const beats = scaffolded.beats.map((beat, i) => {
    const beatResult = llmResult.beatResults.find((br) => br.index === i);
    if (!beatResult) {
      return beat;
    }

    const updatedBeat = { ...beat };

    // Set narration text only if beat has no text
    if (beatResult.text && (!beat.text || beat.text.trim() === "")) {
      updatedBeat.text = beatResult.text;
    }

    // Merge meta
    updatedBeat.meta = {
      ...beat.meta,
      ...beatResult.meta,
    };

    return updatedBeat;
  });

  return {
    ...scaffolded,
    beats,
    scriptMeta: llmResult.scriptMeta,
  };
};

export const runNarrate = async (filePath: string, options: NarrateOptions): Promise<void> => {
  const inputPath = path.resolve(filePath);

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const basename = getBasename(inputPath);
  const mulmoScriptPath = getMulmoScriptPath(basename);
  const scriptDir = path.dirname(mulmoScriptPath);

  // Step 1: Convert source to MulmoScript
  if (!options.force && fs.existsSync(mulmoScriptPath)) {
    console.log(`\n✓ Using existing MulmoScript: ${mulmoScriptPath}`);
  } else {
    console.log(`\nConverting ${path.basename(inputPath)} to MulmoScript...`);
    await convertSourceToMulmoScript(inputPath, options);

    if (!fs.existsSync(mulmoScriptPath)) {
      console.error(`MulmoScript not generated: ${mulmoScriptPath}`);
      process.exit(1);
    }
    console.log(`✓ MulmoScript generated: ${mulmoScriptPath}`);
  }

  // Step 2: Load inputs
  const mulmoScript = readJsonFile<MulmoScript>(mulmoScriptPath);
  const extractedTexts = loadExtractedTexts(scriptDir);

  // Step 3: Scaffold
  const scaffolded = scaffoldExtendedMulmoScript(mulmoScript, extractedTexts);

  if (options.scaffoldOnly) {
    // Write scaffold and exit
    const outputPath = path.join(scriptDir, "extended_script.json");
    writeJsonFile(outputPath, scaffolded);
    console.log(`\n✓ Scaffolded ExtendedMulmoScript: ${outputPath}`);
    console.log(`  Beats: ${scaffolded.beats.length}`);
    console.log(`\nNext: Use Claude Code to analyze and add narration/metadata`);
    return;
  }

  // Step 4: LLM generation
  console.log(`\nGenerating narration and metadata for ${scaffolded.beats.length} beats...`);
  const beatInputs = buildBeatInputs(mulmoScript, extractedTexts);
  const sourceContent = loadSourceContent(inputPath);
  const lang = (options.lang ?? mulmoScript.lang ?? "en") as SupportedLang;

  const { generateNarrationAndMetadata } = await import("../utils/llm-metadata.js");
  const llmResult = await generateNarrationAndMetadata({
    beats: beatInputs,
    lang,
    title: mulmoScript.title,
    sourceContent,
  });

  // Step 5: Merge scaffold + LLM results
  const extendedScript = applyLLMResults(scaffolded, llmResult);

  // Step 6: Validate
  const result = extendedMulmoScriptSchema.safeParse(extendedScript);
  if (!result.success) {
    console.warn(`\nWarning: Validation issues found:`);
    console.warn(formatZodError(result.error));
    console.warn(`Writing output anyway...`);
  }

  // Step 7: Write output
  const outputPath = path.join(scriptDir, "extended_script.json");
  writeJsonFile(outputPath, extendedScript);

  // Summary
  const sections = [
    ...new Set(extendedScript.beats.map((b) => b.meta?.section).filter(Boolean)),
  ] as string[];
  const keywords = extendedScript.scriptMeta?.keywords;

  console.log(`\n✓ ExtendedMulmoScript generated: ${outputPath}`);
  console.log(`  Beats: ${extendedScript.beats.length}`);
  if (sections.length > 0) {
    console.log(`  Sections: ${sections.join(", ")}`);
  }
  if (keywords && keywords.length > 0) {
    console.log(`  Keywords: ${keywords.join(", ")}`);
  }

  console.log(`\nNext steps:`);
  console.log(`  # Validate`);
  console.log(`  yarn cli extend validate ${outputPath}`);
  console.log(`  # Generate video`);
  console.log(`  npx mulmocast-preprocessor ${outputPath} -o ${mulmoScriptPath}`);
  console.log(`  npx mulmo movie ${mulmoScriptPath}`);
};

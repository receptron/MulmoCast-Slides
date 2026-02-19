import * as fs from "fs";
import * as path from "path";
import { processScript } from "@mulmocast/script-utils";
import type { ExtendedMulmoScript } from "@mulmocast/extended-types";
import type { SupportedLang } from "../utils/lang.js";
import {
  detectFileType,
  getBasename,
  convertToMulmoScript,
  getMulmoScriptPath,
  readJsonFile,
  writeJsonFile,
} from "./common.js";
import { runNarrate } from "./narrate.js";
export interface PipelineOptions {
  lang?: SupportedLang;
  force?: boolean;
  generateText?: boolean;
  profile?: string;
  section?: string;
  tags?: string[];
  separator?: string;
  mermaid?: boolean;
  themePath?: string;
  allowLocalFiles?: boolean;
}

const getExtendedScriptPath = (basename: string): string => {
  return path.join("scripts", basename, "extended_script.json");
};

const processExtendedScript = (
  extendedScriptPath: string,
  mulmoScriptPath: string,
  options: PipelineOptions
): void => {
  const extendedScript = readJsonFile<ExtendedMulmoScript>(extendedScriptPath);
  const mulmoScript = processScript(extendedScript, {
    profile: options.profile,
    section: options.section,
    tags: options.tags,
  });
  writeJsonFile(mulmoScriptPath, mulmoScript);
  console.log(`✓ Processed ExtendedMulmoScript → MulmoScript: ${mulmoScriptPath}`);
  if (options.profile) {
    console.log(`  Profile: ${options.profile}`);
  }
  if (options.section) {
    console.log(`  Section: ${options.section}`);
  }
  if (options.tags && options.tags.length > 0) {
    console.log(`  Tags: ${options.tags.join(", ")}`);
  }
};

const hasProcessOptions = (options: PipelineOptions): boolean => {
  return !!(options.profile || options.section || (options.tags && options.tags.length > 0));
};

export async function ensureMulmoScript(
  inputPath: string,
  options: PipelineOptions = {}
): Promise<string> {
  const absolutePath = path.resolve(inputPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const basename = getBasename(absolutePath);
  const mulmoScriptPath = getMulmoScriptPath(basename);
  const extendedScriptPath = getExtendedScriptPath(basename);

  if (options.generateText) {
    // LLM narration pipeline: narrate → processScript → MulmoScript
    if (!options.force && fs.existsSync(extendedScriptPath)) {
      console.log(`\n✓ Using existing ExtendedMulmoScript: ${extendedScriptPath}`);
    } else {
      await runNarrate(inputPath, {
        lang: options.lang,
        force: options.force,
        separator: options.separator,
        mermaid: options.mermaid,
        themePath: options.themePath,
        allowLocalFiles: options.allowLocalFiles,
      });
    }

    // Process ExtendedMulmoScript → MulmoScript
    processExtendedScript(extendedScriptPath, mulmoScriptPath, options);
  } else {
    // Simple conversion: source → MulmoScript
    if (!options.force && fs.existsSync(mulmoScriptPath)) {
      console.log(`\n✓ Using existing MulmoScript: ${mulmoScriptPath}`);
    } else {
      const fileType = detectFileType(absolutePath);
      await convertToMulmoScript(absolutePath, fileType, {
        generateText: false,
        lang: options.lang,
        themePath: options.themePath,
        allowLocalFiles: options.allowLocalFiles,
      });

      if (!fs.existsSync(mulmoScriptPath)) {
        throw new Error(`MulmoScript not generated: ${mulmoScriptPath}`);
      }
      console.log(`\n✓ MulmoScript generated: ${mulmoScriptPath}`);
    }

    // Apply profile/section/tags if extended_script.json exists and options specified
    if (hasProcessOptions(options) && fs.existsSync(extendedScriptPath)) {
      processExtendedScript(extendedScriptPath, mulmoScriptPath, options);
    }
  }

  return mulmoScriptPath;
}

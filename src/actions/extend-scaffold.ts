import * as fs from "fs";
import * as path from "path";
import type { MulmoScript, MulmoBeat } from "@mulmocast/types";
import type { ExtendedMulmoScript, ExtendedMulmoBeat, BeatMeta } from "@mulmocast/extended-types";
import { readJsonFile, writeJsonFile, loadExtractedTexts } from "./common.js";

const addBeatIds = (beats: MulmoBeat[]): ExtendedMulmoBeat[] => {
  return beats.map((beat, i) => {
    if (beat.id) {
      return beat as ExtendedMulmoBeat;
    }
    return { ...beat, id: `beat-${i + 1}` } as ExtendedMulmoBeat;
  });
};

const addBeatMeta = (beats: ExtendedMulmoBeat[], extractedTexts: string[] | null): ExtendedMulmoBeat[] => {
  return beats.map((beat, i) => {
    const meta: BeatMeta = { ...(beat.meta ?? {}) };
    if (extractedTexts && i < extractedTexts.length && extractedTexts[i]) {
      meta.notes = extractedTexts[i];
    }
    return { ...beat, meta };
  });
};

export const scaffoldExtendedMulmoScript = (
  mulmoScript: MulmoScript,
  extractedTexts: string[] | null
): ExtendedMulmoScript => {
  const beats = addBeatMeta(addBeatIds(mulmoScript.beats), extractedTexts);

  // Set defaults first so the spread preserves existing values
  // (JSON may include scriptMeta/outputProfiles not in MulmoScript type)
  return {
    scriptMeta: {},
    outputProfiles: {},
    ...mulmoScript,
    beats,
  } as ExtendedMulmoScript;
};

interface ScaffoldSummary {
  beatCount: number;
  idsAdded: number;
  notesAdded: number;
  outputPath: string;
}

const buildSummary = (
  mulmoScript: MulmoScript,
  result: ExtendedMulmoScript,
  outputPath: string
): ScaffoldSummary => ({
  beatCount: result.beats.length,
  idsAdded: mulmoScript.beats.filter((b) => !b.id).length,
  notesAdded: result.beats.filter((b) => b.meta?.notes).length,
  outputPath,
});

const printSummary = (summary: ScaffoldSummary): void => {
  console.log(`\n✓ Scaffolded ExtendedMulmoScript: ${summary.outputPath}`);
  console.log(`  Beats: ${summary.beatCount}`);
  if (summary.idsAdded > 0) {
    console.log(`  IDs added: ${summary.idsAdded}`);
  }
  if (summary.notesAdded > 0) {
    console.log(`  Notes from extracted_texts: ${summary.notesAdded}`);
  }
  console.log(`\nNext: Add narration and metadata manually or with LLM`);
};

export const runExtendScaffold = (filePath: string): void => {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const mulmoScript = readJsonFile<MulmoScript>(resolvedPath);
  const dir = path.dirname(resolvedPath);
  const extractedTexts = loadExtractedTexts(dir);
  const result = scaffoldExtendedMulmoScript(mulmoScript, extractedTexts);

  const outputPath = path.join(dir, "extended_script.json");
  writeJsonFile(outputPath, result);

  printSummary(buildSummary(mulmoScript, result, outputPath));
};

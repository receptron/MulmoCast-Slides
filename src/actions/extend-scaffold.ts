import * as fs from "fs";
import * as path from "path";
import type { MulmoScript, MulmoBeat } from "@mulmocast/types";
import type { ExtendedScript, ExtendedBeat, BeatMeta } from "@mulmocast/extended-types";

const addBeatIds = (beats: MulmoBeat[]): ExtendedBeat[] => {
  return beats.map((beat, i) => {
    if (beat.id) {
      return beat as ExtendedBeat;
    }
    return { ...beat, id: `beat-${i + 1}` } as ExtendedBeat;
  });
};

const addBeatMeta = (beats: ExtendedBeat[], extractedTexts: string[] | null): ExtendedBeat[] => {
  return beats.map((beat, i) => {
    const meta: BeatMeta = { ...(beat.meta ?? {}) };
    if (extractedTexts && i < extractedTexts.length && extractedTexts[i]) {
      meta.notes = extractedTexts[i];
    }
    return { ...beat, meta };
  });
};

export const scaffoldExtendedScript = (
  mulmoScript: MulmoScript,
  extractedTexts: string[] | null
): ExtendedScript => {
  const beats = addBeatMeta(addBeatIds(mulmoScript.beats), extractedTexts);

  // Set defaults first so the spread preserves existing values
  // (JSON may include scriptMeta/outputProfiles not in MulmoScript type)
  return {
    scriptMeta: {},
    outputProfiles: {},
    ...mulmoScript,
    beats,
  } as ExtendedScript;
};

interface ScaffoldSummary {
  beatCount: number;
  idsAdded: number;
  notesAdded: number;
  outputPath: string;
}

const readJsonFile = <T>(filePath: string): T => {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
};

const loadExtractedTexts = (dir: string): string[] | null => {
  const textsPath = path.join(dir, "extracted_texts.json");
  if (!fs.existsSync(textsPath)) {
    return null;
  }
  try {
    return readJsonFile<string[]>(textsPath);
  } catch {
    console.warn(`Warning: Could not parse ${textsPath}, skipping notes`);
    return null;
  }
};

const buildSummary = (
  mulmoScript: MulmoScript,
  result: ExtendedScript,
  outputPath: string
): ScaffoldSummary => ({
  beatCount: result.beats.length,
  idsAdded: mulmoScript.beats.filter((b) => !b.id).length,
  notesAdded: result.beats.filter((b) => b.meta?.notes).length,
  outputPath,
});

const printSummary = (summary: ScaffoldSummary): void => {
  console.log(`\n✓ Scaffolded ExtendedScript: ${summary.outputPath}`);
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
  const result = scaffoldExtendedScript(mulmoScript, extractedTexts);

  const outputPath = path.join(dir, "extended_script.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");

  printSummary(buildSummary(mulmoScript, result, outputPath));
};

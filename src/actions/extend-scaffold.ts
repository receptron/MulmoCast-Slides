import * as fs from "fs";
import * as path from "path";

interface Beat {
  id?: string;
  text?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

interface MulmoScript {
  beats: Beat[];
  scriptMeta?: Record<string, unknown>;
  outputProfiles?: Record<string, unknown>;
  [key: string]: unknown;
}

const addBeatIds = (beats: Beat[]): Beat[] => {
  return beats.map((beat, i) => {
    if (beat.id) {
      return beat;
    }
    return { ...beat, id: `beat-${i + 1}` };
  });
};

const addBeatMeta = (beats: Beat[], extractedTexts: string[] | null): Beat[] => {
  return beats.map((beat, i) => {
    const meta: Record<string, unknown> = { ...(beat.meta ?? {}) };
    if (extractedTexts && i < extractedTexts.length && extractedTexts[i]) {
      meta.notes = extractedTexts[i];
    }
    return { ...beat, meta };
  });
};

export const scaffoldExtendedScript = (
  mulmoScript: MulmoScript,
  extractedTexts: string[] | null
): MulmoScript => {
  const beats = addBeatMeta(addBeatIds(mulmoScript.beats), extractedTexts);

  return {
    ...mulmoScript,
    beats,
    scriptMeta: mulmoScript.scriptMeta ?? {},
    outputProfiles: mulmoScript.outputProfiles ?? {},
  };
};

interface ScaffoldSummary {
  beatCount: number;
  idsAdded: number;
  notesAdded: number;
  outputPath: string;
}

export const runExtendScaffold = (filePath: string): void => {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  let mulmoScript: MulmoScript;
  try {
    const content = fs.readFileSync(resolvedPath, "utf-8");
    mulmoScript = JSON.parse(content) as MulmoScript;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Failed to parse JSON: ${message}`);
    process.exit(1);
  }

  // Load extracted_texts.json from the same directory if it exists
  const dir = path.dirname(resolvedPath);
  const extractedTextsPath = path.join(dir, "extracted_texts.json");
  let extractedTexts: string[] | null = null;
  if (fs.existsSync(extractedTextsPath)) {
    try {
      const content = fs.readFileSync(extractedTextsPath, "utf-8");
      extractedTexts = JSON.parse(content) as string[];
    } catch {
      console.warn(`Warning: Could not parse ${extractedTextsPath}, skipping notes`);
    }
  }

  // Count stats before scaffolding
  const beatsWithoutId = mulmoScript.beats.filter((b) => !b.id).length;

  const result = scaffoldExtendedScript(mulmoScript, extractedTexts);

  // Count notes added
  const notesAdded = result.beats.filter((b) => b.meta && "notes" in b.meta && b.meta.notes).length;

  // Write output
  const outputPath = path.join(dir, "extended_script.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");

  const summary: ScaffoldSummary = {
    beatCount: result.beats.length,
    idsAdded: beatsWithoutId,
    notesAdded,
    outputPath,
  };

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

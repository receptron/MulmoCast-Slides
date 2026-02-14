import * as fs from "fs";
import * as path from "path";
import type {
  ExtendedMulmoScript,
  BeatVariant,
  ExtendedMulmoViewerData,
} from "@mulmocast/extended-types";

/** Viewer-side variant: only text/skip (image data is already baked into imageSource) */
type ViewerBeatVariant = Pick<BeatVariant, "text" | "skip">;

const pickTextSkip = (
  variants: Record<string, { text?: string; skip?: boolean }>
): Record<string, ViewerBeatVariant> => {
  const result: Record<string, ViewerBeatVariant> = {};
  Object.entries(variants).forEach(([profile, v]) => {
    const picked: ViewerBeatVariant = {};
    if (v.text !== undefined) {
      picked.text = v.text;
    }
    if (v.skip !== undefined) {
      picked.skip = v.skip;
    }
    if (Object.keys(picked).length > 0) {
      result[profile] = picked;
    }
  });
  return result;
};

const parseJsonFile = <T>(filePath: string): T => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch (e) {
    throw new Error(`Failed to parse ${filePath}: ${(e as Error).message}`, { cause: e });
  }
};

/**
 * Merge extended metadata from extended_script.json into mulmo_view.json.
 * No-op if extended_script.json does not exist (backward compatible).
 */
export const mergeExtendedMetadata = (bundleDir: string, scriptsDir: string): void => {
  const extendedPath = path.join(scriptsDir, "extended_script.json");
  if (!fs.existsSync(extendedPath)) {
    return;
  }

  const viewJsonPath = path.join(bundleDir, "mulmo_view.json");
  if (!fs.existsSync(viewJsonPath)) {
    return;
  }

  const extended = parseJsonFile<ExtendedMulmoScript>(extendedPath);
  const viewerData = parseJsonFile<ExtendedMulmoViewerData>(viewJsonPath);

  const CREDIT_BEAT_ID = "mulmo_credit";
  const contentBeats = viewerData.beats.filter((b) => b.id !== CREDIT_BEAT_ID);

  if (contentBeats.length !== extended.beats.length) {
    throw new Error(
      `Beat count mismatch: mulmo_view.json has ${contentBeats.length} content beats, ` +
        `extended_script.json has ${extended.beats.length} beats`
    );
  }

  contentBeats.forEach((viewBeat, i) => {
    const extBeat = extended.beats[i];

    if (extBeat.id) {
      viewBeat.id = extBeat.id;
    }
    if (extBeat.meta) {
      viewBeat.meta = extBeat.meta;
    }
    if (extBeat.variants) {
      const picked = pickTextSkip(extBeat.variants);
      if (Object.keys(picked).length > 0) {
        viewBeat.variants = picked;
      }
    }
  });

  if (extended.scriptMeta && Object.keys(extended.scriptMeta).length > 0) {
    viewerData.scriptMeta = extended.scriptMeta;
  }
  if (extended.outputProfiles && Object.keys(extended.outputProfiles).length > 0) {
    viewerData.outputProfiles = extended.outputProfiles;
  }

  fs.writeFileSync(viewJsonPath, JSON.stringify(viewerData, null, 2));
};

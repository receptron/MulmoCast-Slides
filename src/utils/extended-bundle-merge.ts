import * as fs from "fs";
import * as path from "path";
import type {
  ExtendedMulmoScript,
  BeatMeta,
  ScriptMeta,
  OutputProfile,
} from "@mulmocast/extended-types";

/** Viewer beat fields from mulmo_view.json (mirrors mulmocast's MulmoViewerBeat) */
interface MulmoViewerBeat {
  text?: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  importance?: number;
  multiLinguals?: Record<string, string>;
  audioSources?: Record<string, string | undefined>;
  imageSource?: string;
  videoSource?: string;
  videoWithAudioSource?: string;
  htmlImageSource?: string;
  soundEffectSource?: string;
}

/** Viewer data from mulmo_view.json (mirrors mulmocast's MulmoViewerData) */
interface MulmoViewerData {
  beats: MulmoViewerBeat[];
  bgmSource?: string;
  bgmFile?: string;
  title?: string;
  lang?: string;
}

/** Viewer-side variant: only text/skip (image data is already baked into imageSource) */
export interface ViewerBeatVariant {
  text?: string;
  skip?: boolean;
}

/** MulmoViewerBeat extended with metadata from ExtendedMulmoScript */
export interface ExtendedMulmoViewerBeat extends MulmoViewerBeat {
  id?: string;
  meta?: BeatMeta;
  variants?: Record<string, ViewerBeatVariant>;
}

/** MulmoViewerData extended with script-level metadata */
export interface ExtendedMulmoViewerData extends MulmoViewerData {
  beats: ExtendedMulmoViewerBeat[];
  scriptMeta?: ScriptMeta;
  outputProfiles?: Record<string, OutputProfile>;
}

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

  const extended: ExtendedMulmoScript = JSON.parse(fs.readFileSync(extendedPath, "utf-8"));
  const viewerData: ExtendedMulmoViewerData = JSON.parse(fs.readFileSync(viewJsonPath, "utf-8"));

  const beatCount = Math.min(viewerData.beats.length, extended.beats.length);

  for (let i = 0; i < beatCount; i++) {
    const extBeat = extended.beats[i];
    const viewBeat = viewerData.beats[i];

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
  }

  if (extended.scriptMeta && Object.keys(extended.scriptMeta).length > 0) {
    viewerData.scriptMeta = extended.scriptMeta;
  }
  if (extended.outputProfiles && Object.keys(extended.outputProfiles).length > 0) {
    viewerData.outputProfiles = extended.outputProfiles;
  }

  fs.writeFileSync(viewJsonPath, JSON.stringify(viewerData, null, 2));
};

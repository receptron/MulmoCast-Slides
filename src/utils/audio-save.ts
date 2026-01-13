import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";
import OpenAI from "openai";
import type { MulmoViewerData, MulmoScript } from "mulmocast";

export interface TranscribeRequest {
  audioBase64: string; // base64 encoded audio data (WebM format)
  lang?: string; // language hint for transcription
}

export interface TranscribeResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface SaveAudioRequest {
  bundlePath: string; // e.g., "GraphAI/mulmo_script"
  beatIndex: number;
  langKey: string; // e.g., "recorded", "ja-custom"
  audioBase64: string; // base64 encoded audio data
  text?: string; // transcribed/edited text to save
}

export interface SaveAudioResult {
  success: boolean;
  audioFile?: string;
  error?: string;
}

// Extended MulmoViewerData with optional fields that may exist in generated bundles
type MulmoViewerDataExtended = MulmoViewerData & {
  lang?: string;
  totalDuration?: number;
  totalSegments?: number;
};

// Transcribe audio using OpenAI Whisper API
export async function transcribeAudio(request: TranscribeRequest): Promise<TranscribeResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "OPENAI_API_KEY environment variable is required" };
    }

    const openai = new OpenAI({ apiKey });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(request.audioBase64, "base64");

    // Create a temporary file for the audio (Whisper API needs a file)
    const tempFile = path.join(os.tmpdir(), `mulmo_transcribe_${Date.now()}.webm`);
    fs.writeFileSync(tempFile, audioBuffer);

    try {
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: "whisper-1",
        language: request.lang || undefined,
      });

      return { success: true, text: response.text };
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transcription failed",
    };
  }
}

// Find the scripts directory for a given bundle
function findScriptsDir(outputDir: string, bundlePath: string): string | null {
  // bundlePath is like "GraphAI/mulmo_script"
  // scripts dir is like "scripts/GraphAI"
  const parts = bundlePath.split("/");
  if (parts.length < 1) return null;

  const basename = parts[0];
  const scriptsDir = path.join(process.cwd(), "scripts", basename);

  if (fs.existsSync(scriptsDir)) {
    return scriptsDir;
  }
  return null;
}

export function saveAudio(outputDir: string, request: SaveAudioRequest): SaveAudioResult {
  try {
    const { bundlePath, beatIndex, langKey, audioBase64, text } = request;

    // Validate bundle path
    const bundleDir = path.join(outputDir, bundlePath);
    if (!fs.existsSync(bundleDir)) {
      return { success: false, error: `Bundle directory not found: ${bundlePath}` };
    }

    // Check mulmo_view.json exists
    const viewPath = path.join(bundleDir, "mulmo_view.json");
    if (!fs.existsSync(viewPath)) {
      return { success: false, error: `mulmo_view.json not found in ${bundlePath}` };
    }

    // Read current mulmo_view.json
    const viewData: MulmoViewerDataExtended = JSON.parse(fs.readFileSync(viewPath, "utf-8"));

    // Validate beat index
    if (beatIndex < 0 || beatIndex >= viewData.beats.length) {
      return {
        success: false,
        error: `Invalid beat index: ${beatIndex}. Valid range: 0-${viewData.beats.length - 1}`,
      };
    }

    // Generate audio filename
    const audioFile = `${beatIndex + 1}_${langKey}.mp3`;
    const audioPath = path.join(bundleDir, audioFile);

    // Decode audio buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Save WebM to temporary file and convert to MP3 using FFmpeg
    const tempWebmFile = path.join(os.tmpdir(), `mulmo_record_${Date.now()}.webm`);
    try {
      fs.writeFileSync(tempWebmFile, audioBuffer);

      // Convert WebM to MP3 using FFmpeg (using spawnSync to avoid command injection)
      const result = spawnSync(
        "ffmpeg",
        ["-i", tempWebmFile, "-y", "-codec:a", "libmp3lame", "-qscale:a", "2", audioPath],
        { encoding: "utf-8" }
      );

      if (result.error || result.status !== 0) {
        throw new Error(`FFmpeg conversion failed: ${result.stderr || result.error?.message}`);
      }
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempWebmFile)) {
        fs.unlinkSync(tempWebmFile);
      }
    }

    // Ensure audioSources and multiLinguals exist
    const beat = viewData.beats[beatIndex];
    if (!beat.audioSources) {
      beat.audioSources = {};
    }
    if (!beat.multiLinguals) {
      beat.multiLinguals = {};
    }

    // Update mulmo_view.json
    beat.audioSources[langKey] = audioFile;

    // Update text if provided
    if (text !== undefined) {
      beat.multiLinguals[langKey] = text;
    } else if (!beat.multiLinguals[langKey]) {
      // Use original text as placeholder if no text provided
      const originalLang = viewData.lang || "en";
      beat.multiLinguals[langKey] = beat.multiLinguals[originalLang] || beat.text || "";
    }

    // Save updated mulmo_view.json
    fs.writeFileSync(viewPath, JSON.stringify(viewData, null, 2));

    // Also update mulmo_script.json if it exists in scripts directory
    const scriptsDir = findScriptsDir(outputDir, bundlePath);
    if (scriptsDir && text !== undefined) {
      const scriptPath = path.join(scriptsDir, "mulmo_script.json");
      if (fs.existsSync(scriptPath)) {
        try {
          const scriptData: MulmoScript = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
          if (scriptData.beats && scriptData.beats[beatIndex]) {
            scriptData.beats[beatIndex].text = text;
            fs.writeFileSync(scriptPath, JSON.stringify(scriptData, null, 2));
          }
        } catch {
          // Ignore script update errors
        }
      }
    }

    return { success: true, audioFile };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Parse request body from incoming request (generic version)
export async function parseRequestBody<T = any>(req: any): Promise<T | null> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => {
      resolve(null);
    });
  });
}

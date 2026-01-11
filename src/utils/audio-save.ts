import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

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

interface MulmoViewData {
  lang: string;
  totalDuration: number;
  totalSegments: number;
  beats: Array<{
    text: string;
    audioSources: Record<string, string>;
    multiLinguals: Record<string, string>;
    videoSource?: string;
    imageSource?: string;
    thumbnail?: string;
    startTime?: number;
    endTime?: number;
    duration?: number;
  }>;
}

interface MulmoScriptData {
  $mulmocast?: {
    version: string;
    credit?: string;
  };
  lang: string;
  title?: string;
  description?: string;
  beats: Array<{
    text: string;
    image?: any;
    [key: string]: any;
  }>;
}

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
    const tempDir = path.join(process.cwd(), ".tmp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, `transcribe_${Date.now()}.webm`);
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
    const viewData: MulmoViewData = JSON.parse(fs.readFileSync(viewPath, "utf-8"));

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

    // Decode and save audio file
    const audioBuffer = Buffer.from(audioBase64, "base64");
    fs.writeFileSync(audioPath, audioBuffer);

    // Update mulmo_view.json
    viewData.beats[beatIndex].audioSources[langKey] = audioFile;

    // Update text if provided
    if (text !== undefined) {
      viewData.beats[beatIndex].multiLinguals[langKey] = text;
    } else if (!viewData.beats[beatIndex].multiLinguals[langKey]) {
      // Use original text as placeholder if no text provided
      const originalLang = viewData.lang;
      viewData.beats[beatIndex].multiLinguals[langKey] =
        viewData.beats[beatIndex].multiLinguals[originalLang] || viewData.beats[beatIndex].text;
    }

    // Save updated mulmo_view.json
    fs.writeFileSync(viewPath, JSON.stringify(viewData, null, 2));

    // Also update mulmo_script.json if it exists in scripts directory
    const scriptsDir = findScriptsDir(outputDir, bundlePath);
    if (scriptsDir && text !== undefined) {
      const scriptPath = path.join(scriptsDir, "mulmo_script.json");
      if (fs.existsSync(scriptPath)) {
        try {
          const scriptData: MulmoScriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
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

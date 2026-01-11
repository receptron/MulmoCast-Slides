import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { resolveLang, langOption, type SupportedLang } from "../utils/lang";
import { checkDependencies } from "../utils/dependencies";
import OpenAI from "openai";
import { mulmoScriptSchema, type MulmoBeat } from "mulmocast";
import type { z } from "zod";
import { generateMovieBundle } from "./movie_bundle";

type MulmoScriptInput = z.input<typeof mulmoScriptSchema>;

export interface ConvertMovieOptions {
  inputPath: string;
  outputDir?: string;
  lang?: SupportedLang;
  minSegmentDuration?: number;
  maxSegmentDuration?: number;
  bundle?: boolean;
  targetLangs?: string[];
}

export interface ConvertMovieResult {
  mulmoScriptPath: string;
  segmentCount: number;
  bundlePath?: string;
}

interface SilenceInterval {
  start: number;
  end: number;
}

interface Segment {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
}

interface Beat {
  text: string;
  audioSources: Record<string, string>;
  multiLinguals: Record<string, string>;
  videoSource: string;
  imageSource: string;
  startTime: number;
  endTime: number;
  duration: number;
}

// Get video duration using ffprobe
function getVideoDuration(videoPath: string): number {
  const result = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
    { encoding: "utf-8" }
  );
  return parseFloat(result.trim());
}

// Detect silence intervals in video using FFmpeg
async function detectSilence(
  videoPath: string,
  noiseThreshold: number = -30,
  minSilenceDuration: number = 0.5
): Promise<SilenceInterval[]> {
  return new Promise((resolve, reject) => {
    const silences: SilenceInterval[] = [];
    let currentStart: number | null = null;

    const ffmpeg = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-af",
      `silencedetect=noise=${noiseThreshold}dB:d=${minSilenceDuration}`,
      "-f",
      "null",
      "-",
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0 && code !== null) {
        // FFmpeg may return non-zero even on success for silence detection
      }

      // Parse silence_start and silence_end from stderr
      const lines = stderr.split("\n");
      for (const line of lines) {
        const startMatch = line.match(/silence_start:\s*([\d.]+)/);
        const endMatch = line.match(/silence_end:\s*([\d.]+)/);

        if (startMatch) {
          currentStart = parseFloat(startMatch[1]);
        }
        if (endMatch && currentStart !== null) {
          silences.push({
            start: currentStart,
            end: parseFloat(endMatch[1]),
          });
          currentStart = null;
        }
      }

      resolve(silences);
    });

    ffmpeg.on("error", reject);
  });
}

// Calculate segment boundaries based on silence intervals
function calculateSegments(
  totalDuration: number,
  silences: SilenceInterval[],
  minDuration: number = 20,
  maxDuration: number = 120
): Segment[] {
  const segments: Segment[] = [];
  let currentStart = 0;
  let segmentIndex = 1;

  // Get silence midpoints as potential split points
  const splitPoints = silences.map((s) => (s.start + s.end) / 2);

  while (currentStart < totalDuration) {
    const targetEnd = currentStart + maxDuration;

    if (targetEnd >= totalDuration) {
      // Last segment
      segments.push({
        index: segmentIndex,
        startTime: currentStart,
        endTime: totalDuration,
        duration: totalDuration - currentStart,
      });
      break;
    }

    // Find the closest silence point near the target end
    let bestSplit = targetEnd;
    let minDistance = Infinity;

    for (const point of splitPoints) {
      if (point > currentStart + minDuration && point < targetEnd + 30) {
        const distance = Math.abs(point - targetEnd);
        if (distance < minDistance) {
          minDistance = distance;
          bestSplit = point;
        }
      }
    }

    segments.push({
      index: segmentIndex,
      startTime: currentStart,
      endTime: bestSplit,
      duration: bestSplit - currentStart,
    });

    currentStart = bestSplit;
    segmentIndex++;
  }

  // If no silences detected, use fixed segmentation
  if (segments.length === 0) {
    const fixedDuration = 60;
    let start = 0;
    let idx = 1;
    while (start < totalDuration) {
      const end = Math.min(start + fixedDuration, totalDuration);
      segments.push({
        index: idx,
        startTime: start,
        endTime: end,
        duration: end - start,
      });
      start = end;
      idx++;
    }
  }

  return segments;
}

// Split video into segment
function splitVideo(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): void {
  execSync(
    `ffmpeg -y -ss ${startTime} -i "${inputPath}" -t ${duration} -c copy "${outputPath}"`,
    { stdio: "ignore" }
  );
}

// Extract audio from video segment
function extractAudio(videoPath: string, audioPath: string): void {
  execSync(
    `ffmpeg -y -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 "${audioPath}"`,
    { stdio: "ignore" }
  );
}

// Generate thumbnail from video segment
function generateThumbnail(videoPath: string, thumbnailPath: string): void {
  execSync(
    `ffmpeg -y -i "${videoPath}" -ss 0 -vframes 1 -vf "scale=640:-1" "${thumbnailPath}"`,
    { stdio: "ignore" }
  );
}

// Transcribe audio using OpenAI Whisper API
async function transcribeAudio(
  audioPath: string,
  lang: string,
  openai: OpenAI
): Promise<string> {
  const audioFile = fs.createReadStream(audioPath);

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: lang === "ja" ? "ja" : "en",
  });

  return response.text;
}

export async function convertMovie(
  options: ConvertMovieOptions
): Promise<ConvertMovieResult> {
  const {
    inputPath,
    lang,
    minSegmentDuration = 20,
    maxSegmentDuration = 120,
  } = options;
  const videoPath = path.resolve(inputPath);

  if (!fs.existsSync(videoPath)) {
    throw new Error(`File not found: ${videoPath}`);
  }

  // Check for required dependencies
  checkDependencies("movie");

  // Check for OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required for transcription");
  }

  const openai = new OpenAI({ apiKey });

  const ext = path.extname(videoPath);
  const basename = path.basename(videoPath, ext);

  // Scripts directory for MulmoScript and processing assets
  const scriptsDir = options.outputDir || path.join("scripts", basename);
  // Bundle output directory (same structure as other formats)
  const bundleDir = path.join("output", basename, "mulmo_script");

  // Create scripts directory
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  console.log(`Processing video: ${videoPath}`);
  console.log(`Scripts directory: ${scriptsDir}`);

  // Get video duration
  console.log("Getting video duration...");
  const totalDuration = getVideoDuration(videoPath);
  console.log(`  Total duration: ${Math.floor(totalDuration / 60)}m ${Math.floor(totalDuration % 60)}s`);

  // Detect silence intervals
  console.log("Detecting silence intervals...");
  const silences = await detectSilence(videoPath);
  console.log(`  Found ${silences.length} silence intervals`);

  // Calculate segments
  console.log("Calculating segments...");
  const segments = calculateSegments(
    totalDuration,
    silences,
    minSegmentDuration,
    maxSegmentDuration
  );
  console.log(`  Created ${segments.length} segments`);

  // Process each segment
  const beats: Beat[] = [];
  const transcriptions: string[] = [];

  for (const segment of segments) {
    const segmentNum = segment.index;
    const videoFile = `${segmentNum}.mp4`;
    const audioFile = `${segmentNum}.mp3`;
    const thumbnailFile = `${segmentNum}.jpg`;

    const videoOutputPath = path.join(scriptsDir, videoFile);
    const audioOutputPath = path.join(scriptsDir, audioFile);
    const thumbnailOutputPath = path.join(scriptsDir, thumbnailFile);

    console.log(`\nProcessing segment ${segmentNum}/${segments.length}...`);

    // Split video (with caching)
    if (!fs.existsSync(videoOutputPath)) {
      console.log(`  Splitting video...`);
      splitVideo(videoPath, videoOutputPath, segment.startTime, segment.duration);
    } else {
      console.log(`  Using cached video`);
    }

    // Extract audio (with caching)
    if (!fs.existsSync(audioOutputPath)) {
      console.log(`  Extracting audio...`);
      extractAudio(videoOutputPath, audioOutputPath);
    } else {
      console.log(`  Using cached audio`);
    }

    // Generate thumbnail (with caching)
    if (!fs.existsSync(thumbnailOutputPath)) {
      console.log(`  Generating thumbnail...`);
      generateThumbnail(videoOutputPath, thumbnailOutputPath);
    } else {
      console.log(`  Using cached thumbnail`);
    }

    // Transcribe audio
    console.log(`  Transcribing audio...`);
    const transcription = await transcribeAudio(audioOutputPath, lang || "en", openai);
    transcriptions.push(transcription);

    console.log(`  Transcription: ${transcription.substring(0, 100)}...`);

    beats.push({
      text: transcription,
      audioSources: {
        [lang || "en"]: audioFile,
      },
      multiLinguals: {
        [lang || "en"]: transcription,
      },
      videoSource: videoFile,
      imageSource: thumbnailFile,
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.duration,
    });
  }

  // Resolve language from transcriptions
  const resolvedLang = resolveLang(lang, transcriptions);

  // Build MulmoScript with proper schema
  // For video content, we use the `image` field with type: "movie"
  const mulmoBeats: MulmoBeat[] = beats.map((beat) => ({
    text: beat.text,
    image: {
      type: "movie",
      source: {
        kind: "path",
        path: `./${beat.videoSource}`,
      },
    },
  }));

  const mulmoScript: MulmoScriptInput = {
    $mulmocast: {
      version: "1.1",
      credit: "closing",
    },
    lang: resolvedLang,
    beats: mulmoBeats,
  };

  // Validate MulmoScript
  const result = mulmoScriptSchema.safeParse(mulmoScript);
  if (!result.success) {
    console.error("MulmoScript validation failed:");
    console.error(result.error.format());
    throw new Error("Invalid MulmoScript generated");
  }

  // Write MulmoScript to scripts directory
  const jsonPath = path.join(scriptsDir, "mulmo_script.json");
  fs.writeFileSync(jsonPath, JSON.stringify(result.data, null, 2));
  console.log(`\nMulmoScript saved to: ${jsonPath}`);

  // Generate bundle with translations and TTS if requested
  const shouldBundle = options.bundle ?? true; // Default to bundling for movie
  const targetLangs = options.targetLangs ?? ["ja"]; // Default target language

  let bundlePath: string | undefined;

  if (shouldBundle) {
    // Create bundle output directory
    if (!fs.existsSync(bundleDir)) {
      fs.mkdirSync(bundleDir, { recursive: true });
    }
    console.log(`Bundle directory: ${bundleDir}`);

    // Prepare beat data for bundle generation
    const bundleBeats = beats.map((beat, index) => ({
      text: beat.text,
      videoSource: beat.videoSource,
      imageSource: beat.imageSource,
      audioSource: beat.audioSources[resolvedLang] || `${index + 1}.mp3`,
      startTime: beat.startTime,
      endTime: beat.endTime,
      duration: beat.duration,
    }));

    await generateMovieBundle({
      scriptsDir,
      outputDir: bundleDir,
      sourceLang: resolvedLang,
      targetLangs,
      beats: bundleBeats,
      totalDuration,
    });

    bundlePath = path.join(bundleDir, "mulmo_view.json");
  }

  return {
    mulmoScriptPath: jsonPath,
    segmentCount: segments.length,
    bundlePath,
  };
}

async function main() {
  // Load environment variables
  const dotenv = await import("dotenv");
  dotenv.config();

  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: $0 <video-file> [options]")
    .command("$0 <file>", "Convert video to MulmoScript", (yargs) => {
      return yargs.positional("file", {
        describe: "Video file to convert (mp4, mov, mkv, webm, avi)",
        type: "string",
        demandOption: true,
      });
    })
    .options({
      ...langOption,
      "min-segment": {
        type: "number",
        description: "Minimum segment duration in seconds",
        default: 20,
      },
      "max-segment": {
        type: "number",
        description: "Maximum segment duration in seconds",
        default: 120,
      },
      bundle: {
        type: "boolean",
        description: "Generate bundle with translations and TTS",
        default: true,
      },
      "target-langs": {
        type: "string",
        description: "Target languages for translation (comma-separated)",
        default: "ja",
      },
    })
    .help()
    .parse();

  await convertMovie({
    inputPath: argv.file as string,
    lang: argv.l as SupportedLang | undefined,
    minSegmentDuration: argv["min-segment"],
    maxSegmentDuration: argv["max-segment"],
    bundle: argv.bundle,
    targetLangs: (argv["target-langs"] as string).split(",").map((l) => l.trim()),
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
}

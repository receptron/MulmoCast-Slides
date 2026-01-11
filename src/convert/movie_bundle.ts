import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  fr: "French",
  de: "German",
  es: "Spanish",
  zh: "Chinese",
  ko: "Korean",
};

export interface BeatData {
  text: string;
  audioSources: Record<string, string>;
  multiLinguals: Record<string, string>;
  videoSource: string;
  thumbnail: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface MulmoViewData {
  lang: string;
  totalDuration: number;
  totalSegments: number;
  beats: BeatData[];
}

// Copy file if it doesn't exist in destination
function copyFileIfNeeded(srcPath: string, destPath: string): void {
  if (!fs.existsSync(destPath) && fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
  }
}

// Translate text using OpenAI with retry logic
async function translateText(
  text: string,
  fromLang: string,
  toLang: string,
  openai: OpenAI,
  maxRetries: number = 3
): Promise<string> {
  if (!text.trim()) {
    return "";
  }

  const fromLangName = LANG_NAMES[fromLang] || fromLang;
  const toLangName = LANG_NAMES[toLang] || toLang;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Translate the given ${fromLangName} text to natural ${toLangName}. Only return the translated text, nothing else.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
      });

      return response.choices[0]?.message?.content?.trim() || text;
    } catch (error) {
      console.warn(`Translation attempt ${attempt}/${maxRetries} failed: ${error}`);
      if (attempt === maxRetries) {
        console.warn(`Translation failed after ${maxRetries} attempts, using original text`);
        return text;
      }
      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  return text;
}

// Generate TTS audio using OpenAI with retry logic
async function textToSpeech(
  text: string,
  outputPath: string,
  lang: string,
  openai: OpenAI,
  maxRetries: number = 3
): Promise<void> {
  if (!text.trim()) {
    return;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      return;
    } catch (error) {
      console.warn(`TTS attempt ${attempt}/${maxRetries} failed: ${error}`);
      if (attempt === maxRetries) {
        console.error(`TTS generation failed for ${outputPath} after ${maxRetries} attempts`);
        throw error;
      }
      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

export interface MovieBundleOptions {
  scriptsDir: string; // Source directory with processed assets
  outputDir: string; // Output directory for bundle
  sourceLang: string;
  targetLangs: string[];
  beats: Array<{
    text: string;
    videoSource: string;
    imageSource: string;
    audioSource: string;
    startTime: number;
    endTime: number;
    duration: number;
  }>;
  totalDuration: number;
}

export async function generateMovieBundle(
  options: MovieBundleOptions
): Promise<MulmoViewData> {
  const { scriptsDir, outputDir, sourceLang, targetLangs, beats, totalDuration } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const openai = new OpenAI({ apiKey });
  const bundleBeats: BeatData[] = [];

  console.log(`\nGenerating bundle with ${beats.length} segments...`);
  console.log(`  Source: ${scriptsDir}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Source language: ${sourceLang}`);
  console.log(`  Target languages: ${targetLangs.join(", ")}`);

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const segmentNum = i + 1;

    console.log(`\nProcessing segment ${segmentNum}/${beats.length}...`);

    // Copy source assets to output directory
    const srcVideoPath = path.join(scriptsDir, beat.videoSource);
    const srcAudioPath = path.join(scriptsDir, beat.audioSource);
    const srcThumbnailPath = path.join(scriptsDir, beat.imageSource);

    const destVideoPath = path.join(outputDir, beat.videoSource);
    const destAudioPath = path.join(outputDir, beat.audioSource);
    const destThumbnailPath = path.join(outputDir, beat.imageSource);

    console.log(`  Copying assets...`);
    copyFileIfNeeded(srcVideoPath, destVideoPath);
    copyFileIfNeeded(srcAudioPath, destAudioPath);
    copyFileIfNeeded(srcThumbnailPath, destThumbnailPath);

    // Initialize audioSources and multiLinguals with source language
    const audioSources: Record<string, string> = {
      [sourceLang]: beat.audioSource,
    };
    const multiLinguals: Record<string, string> = {
      [sourceLang]: beat.text,
    };

    // Process each target language
    for (const targetLang of targetLangs) {
      if (targetLang === sourceLang) {
        continue;
      }

      const targetAudioFile = `${segmentNum}_${targetLang}.mp3`;
      const targetAudioPath = path.join(outputDir, targetAudioFile);

      // Check if translation/audio already exists (caching)
      if (fs.existsSync(targetAudioPath)) {
        console.log(`  Using cached ${targetLang} audio`);
        audioSources[targetLang] = targetAudioFile;

        // Try to read cached translation from existing mulmo_view.json
        const viewPath = path.join(outputDir, "mulmo_view.json");
        if (fs.existsSync(viewPath)) {
          try {
            const existingView = JSON.parse(fs.readFileSync(viewPath, "utf-8"));
            const existingBeat = existingView.beats?.[i];
            if (existingBeat?.multiLinguals?.[targetLang]) {
              multiLinguals[targetLang] = existingBeat.multiLinguals[targetLang];
              continue;
            }
          } catch {
            // Ignore cache read errors
          }
        }
      }

      // Translate text
      console.log(`  Translating to ${targetLang}...`);
      const translatedText = await translateText(beat.text, sourceLang, targetLang, openai);
      multiLinguals[targetLang] = translatedText;

      // Generate TTS audio if not cached
      if (!fs.existsSync(targetAudioPath)) {
        console.log(`  Generating ${targetLang} audio...`);
        await textToSpeech(translatedText, targetAudioPath, targetLang, openai);
      }
      audioSources[targetLang] = targetAudioFile;
    }

    bundleBeats.push({
      text: beat.text,
      audioSources,
      multiLinguals,
      videoSource: beat.videoSource,
      thumbnail: beat.imageSource,
      startTime: beat.startTime,
      endTime: beat.endTime,
      duration: beat.duration,
    });
  }

  const mulmoView: MulmoViewData = {
    lang: sourceLang,
    totalDuration,
    totalSegments: beats.length,
    beats: bundleBeats,
  };

  // Write mulmo_view.json
  const viewPath = path.join(outputDir, "mulmo_view.json");
  fs.writeFileSync(viewPath, JSON.stringify(mulmoView, null, 2));
  console.log(`\nBundle saved to: ${viewPath}`);

  return mulmoView;
}

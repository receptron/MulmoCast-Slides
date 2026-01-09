import { franc } from "franc";

// Supported languages
export const SUPPORTED_LANGS = ["en", "ja", "fr", "de"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: SupportedLang = "en";

// Map franc's ISO 639-3 codes to our supported 2-letter codes
const FRANC_TO_LANG: Record<string, SupportedLang> = {
  eng: "en",
  jpn: "ja",
  fra: "fr",
  deu: "de",
};

export function isValidLang(lang: string): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}

export function getLangFromEnv(): SupportedLang | undefined {
  const envLang = process.env.MULMO_LANG;
  if (envLang && isValidLang(envLang)) {
    return envLang;
  }
  return undefined;
}

export function resolveLang(cliLang?: string, texts?: string[]): SupportedLang {
  // Priority: CLI option > environment variable > auto-detect > default
  if (cliLang && isValidLang(cliLang)) {
    return cliLang;
  }
  const envLang = getLangFromEnv();
  if (envLang) {
    return envLang;
  }
  if (texts && texts.length > 0) {
    const detected = detectLang(texts);
    if (detected) {
      console.log(`Auto-detected language: ${detected}`);
      return detected;
    }
  }
  return DEFAULT_LANG;
}

// Yargs option configuration for lang
export const langOption = {
  l: {
    alias: "lang",
    type: "string" as const,
    choices: SUPPORTED_LANGS as unknown as string[],
    description: "Language for the MulmoScript",
    default: undefined,
  },
};

/**
 * Detect language from text using franc library.
 * Combines multiple texts for better accuracy.
 * Returns undefined if language cannot be detected or is not supported.
 */
export function detectLang(texts: string | string[]): SupportedLang | undefined {
  const textArray = Array.isArray(texts) ? texts : [texts];
  const combinedText = textArray.join("\n");

  if (combinedText.length < 10) {
    return undefined;
  }

  const detected = franc(combinedText);
  if (detected === "und") {
    return undefined;
  }

  return FRANC_TO_LANG[detected];
}

// Supported languages
export const SUPPORTED_LANGS = ["en", "ja", "fr", "de"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: SupportedLang = "en";

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

export function resolveLang(cliLang?: string): SupportedLang {
  // Priority: CLI option > environment variable > default
  if (cliLang && isValidLang(cliLang)) {
    return cliLang;
  }
  return getLangFromEnv() ?? DEFAULT_LANG;
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

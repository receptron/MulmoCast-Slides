/**
 * Language utilities (browser-safe)
 *
 * No Node.js dependencies (no franc, no process.env).
 */

export const SUPPORTED_LANGS = ["en", "ja", "fr", "de"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: SupportedLang = "en";

export function isValidLang(lang: string): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}

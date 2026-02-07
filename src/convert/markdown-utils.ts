/**
 * Markdown Converter Utilities
 *
 * Types, constants, and helper functions for markdown conversion.
 */

import * as fs from "fs";
import * as path from "path";
import { mulmoScriptSchema, type MulmoBeat } from "mulmocast";
import type { SupportedLang } from "../utils/lang.js";
import type { SeparatorMode } from "./markdown-plugins/index.js";

// Re-export browser-safe utilities
export {
  EXCLUDED_NOTE_PATTERNS,
  extractNotesFromSlide,
  extractMarkdownFromSlide,
} from "./markdown-utils-common.js";

// ============================================================================
// Types
// ============================================================================

export interface Slide {
  markdown: string;
  beat: Partial<MulmoBeat> | null;
  note: string;
}

export interface ConvertMarkdownOptions {
  inputPath: string;
  outputDir?: string;
  lang?: SupportedLang;
  generateText?: boolean;
  separator?: SeparatorMode;
  mermaid?: boolean;
  directive?: boolean;
  layout?: boolean;
  style?: string;
}

export interface ConvertMarkdownResult {
  mulmoScriptPath: string;
  slideCount: number;
}

// ============================================================================
// Constants
// ============================================================================

export const SEPARATOR_CHOICES = [
  "horizontal-rule",
  "heading",
  "heading-1",
  "heading-2",
  "heading-3",
  "blank-lines",
  "comment",
  "page-break",
] as const;

// ============================================================================
// File I/O
// ============================================================================

export function readMarkdownFile(inputPath: string): string {
  const resolvedPath = path.resolve(inputPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  if (!resolvedPath.endsWith(".md")) {
    throw new Error("Input file must be a .md (Markdown) file");
  }

  return fs.readFileSync(resolvedPath, "utf-8");
}

export function setupOutputDirectory(basename: string, customOutputDir?: string): string {
  const outputFolder = customOutputDir || path.join(process.cwd(), "scripts", basename);

  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  return outputFolder;
}

export function writeMulmoScript(outputFolder: string, data: unknown): string {
  const result = mulmoScriptSchema.safeParse(data);
  if (!result.success) {
    console.error("MulmoScript validation failed:");
    console.error(result.error.format());
    throw new Error("Invalid MulmoScript generated");
  }

  const scriptPath = path.join(outputFolder, "mulmo_script.json");
  fs.writeFileSync(scriptPath, JSON.stringify(result.data, null, 2), "utf-8");
  return scriptPath;
}

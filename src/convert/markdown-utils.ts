/**
 * Markdown Converter Utilities
 *
 * Types, constants, and helper functions for markdown conversion.
 */

import * as fs from "fs";
import * as path from "path";
import { mulmoScriptSchema, type MulmoBeat } from "mulmocast";
import type { z } from "zod";
import type { SupportedLang } from "../utils/lang";
import type { SeparatorMode } from "./markdown-plugins";

// ============================================================================
// Types
// ============================================================================

type MulmoScriptInput = z.input<typeof mulmoScriptSchema>;

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
  style?: string;
}

export interface ConvertMarkdownResult {
  mulmoScriptPath: string;
  slideCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Patterns to exclude from speaker notes
 * Common code comments that should not be treated as narration
 * Requires colon after keyword to avoid false positives (e.g., "Note 1" is OK)
 */
export const EXCLUDED_NOTE_PATTERNS = [
  /^TODO:/i,
  /^FIXME:/i,
  /^HACK:/i,
  /^XXX:/i,
  /^NOTE:/i,
  /^BUG:/i,
  /^WARN(ING)?:/i,
  /^DEPRECATED:/i,
  /^REVIEW:/i,
];

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
// Speaker Notes Extraction
// ============================================================================

const isExcludedComment = (comment: string): boolean =>
  EXCLUDED_NOTE_PATTERNS.some((pattern) => pattern.test(comment));

/**
 * Extract speaker notes from HTML comments in a slide
 * Excludes directive-like comments and common code comments (TODO, FIXME, etc.)
 */
export function extractNotesFromSlide(slideContent: string): string {
  const commentRegex = /<!--\s*([\s\S]*?)\s*-->/g;
  return [...slideContent.matchAll(commentRegex)]
    .map((m) => m[1].trim())
    .filter((comment) => comment.length > 0)
    .filter((comment) => !isExcludedComment(comment))
    .join("\n");
}

/**
 * Extract markdown content from a slide (removes HTML comments)
 */
export function extractMarkdownFromSlide(slideContent: string): string[] {
  const slideWithoutNotes = slideContent.replace(/<!--\s*[\s\S]*?\s*-->/g, "");
  return slideWithoutNotes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

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

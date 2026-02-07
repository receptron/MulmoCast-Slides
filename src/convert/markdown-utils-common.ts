/**
 * Markdown Converter Utilities (browser-safe)
 *
 * Pure functions for markdown processing with no Node.js dependencies.
 */

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

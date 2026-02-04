/**
 * Markdown Plugin System Types
 *
 * Built-in plugins for markdown conversion.
 * HTML rendering is done by mulmocast, not here.
 */

import type { MulmoBeat } from "mulmocast";

/**
 * Separator modes for splitting markdown into slides
 */
export type SeparatorMode =
  | "horizontal-rule" // --- (default, Marp/reveal.js style)
  | "heading" // Any heading (# ## ###)
  | "heading-1" // # only
  | "heading-2" // ## only
  | "heading-3" // ### only
  | "blank-lines" // 3+ blank lines
  | "comment" // <!-- slide -->
  | "page-break" // <!-- pagebreak --> or \f
  | { pattern: string }; // Custom regex pattern

/**
 * Context passed to plugin processors (internal)
 */
export interface PluginContext {
  slideIndex: number;
  totalSlides: number;
}

/**
 * Markdown Plugin Interface (internal)
 */
export interface MarkdownPlugin {
  name: string;
  priority?: number;
  preprocess?: (markdown: string, context: PluginContext) => string;
  toBeat?: (markdown: string, context: PluginContext) => Partial<MulmoBeat> | null;
}

/**
 * Markdown conversion options
 */
export interface MarkdownConvertOptions {
  /** Separator mode for splitting slides */
  separator?: SeparatorMode;

  /** Enable mermaid plugin (converts mermaid code blocks to mermaid beat) */
  mermaid?: boolean;

  /** Enable directive plugin (removes Marp-style directives) */
  directive?: boolean;

  /** Enable layout plugin (auto-detect layout based on content) */
  layout?: boolean;

  /** Style to apply to markdown slides */
  style?: string;
}

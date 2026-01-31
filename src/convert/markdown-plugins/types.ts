/**
 * Markdown Plugin System Types
 *
 * Allows extending markdown conversion with custom processors.
 * Plugins transform markdown before conversion to MulmoScript.
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
 * Context passed to plugin processors
 */
export interface PluginContext {
  slideIndex: number;
  totalSlides: number;
  lang: string;
  metadata: Record<string, unknown>;
}

/**
 * Markdown Plugin Interface
 *
 * Plugins are processed in order:
 * 1. preprocess - Transform raw markdown (remove directives, transform syntax)
 * 2. toBeat - Generate custom beat type (e.g., mermaid, chart)
 */
export interface MarkdownPlugin {
  /** Unique plugin name */
  name: string;

  /** Plugin priority (higher runs first). Default: 0 */
  priority?: number;

  /**
   * Transform markdown before conversion to MulmoScript.
   * Use for removing/transforming directives, custom syntax, etc.
   */
  preprocess?: (markdown: string, context: PluginContext) => string;

  /**
   * Generate custom beat from slide content.
   * Return partial beat to merge, or null to use default markdown beat.
   *
   * @param markdown - Markdown content (after preprocess)
   * @param context - Plugin context
   * @returns Partial beat to merge, or null
   */
  toBeat?: (markdown: string, context: PluginContext) => Partial<MulmoBeat> | null;
}

/**
 * Markdown conversion options
 */
export interface MarkdownConvertOptions {
  /** Separator mode for splitting slides */
  separator?: SeparatorMode;

  /** Plugins to apply (custom plugin instances) */
  plugins?: MarkdownPlugin[];

  /** Plugin names to enable from built-in plugins */
  pluginNames?: string[];

  /** Style to apply to markdown slides */
  style?: string;
}

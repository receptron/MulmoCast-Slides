/**
 * Markdown Plugin System
 *
 * Split markdown by separator and convert to MulmoScript.
 * HTML rendering is done by mulmocast, not here.
 */

import * as fs from "fs";
import * as path from "path";
import type {
  MarkdownPlugin,
  PluginContext,
  PluginRegistry,
  SeparatorMode,
  MarkdownConvertOptions,
} from "./types";

// Re-export types
export * from "./types";

// Built-in plugins
import { mermaidPlugin } from "./mermaid";
import { directivePlugin } from "./directive";

/**
 * Built-in plugins registry
 */
const BUILTIN_PLUGINS: Record<string, MarkdownPlugin> = {
  mermaid: mermaidPlugin,
  directive: directivePlugin,
};

/**
 * Plugin Registry Implementation
 */
class PluginRegistryImpl implements PluginRegistry {
  private plugins: Map<string, MarkdownPlugin> = new Map();

  register(plugin: MarkdownPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string): MarkdownPlugin | undefined {
    return this.plugins.get(name) || BUILTIN_PLUGINS[name];
  }

  getAll(): MarkdownPlugin[] {
    const all = new Map(Object.entries(BUILTIN_PLUGINS));
    this.plugins.forEach((plugin, name) => all.set(name, plugin));
    return Array.from(all.values());
  }

  async loadFromDir(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) {
      return;
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js") || f.endsWith(".ts"));

    for (const file of files) {
      try {
        const modulePath = path.join(dir, file);
        const module = await import(modulePath);
        const plugin = module.default as MarkdownPlugin;

        if (plugin && plugin.name) {
          this.register(plugin);
          console.log(`  Loaded plugin: ${plugin.name}`);
        }
      } catch (error) {
        console.warn(`  Failed to load plugin ${file}:`, error);
      }
    }
  }
}

/**
 * Global plugin registry
 */
export const pluginRegistry = new PluginRegistryImpl();

/**
 * Get separator regex pattern
 */
export function getSeparatorPattern(mode: SeparatorMode): RegExp {
  if (typeof mode === "object" && "pattern" in mode) {
    return new RegExp(mode.pattern, "gm");
  }

  switch (mode) {
    case "horizontal-rule":
      return /\n---\n/;
    case "heading":
      return /\n(?=#{1,6}\s)/;
    case "heading-1":
      return /\n(?=#\s)/;
    case "heading-2":
      return /\n(?=##\s)/;
    case "heading-3":
      return /\n(?=###\s)/;
    case "blank-lines":
      return /\n{3,}/;
    case "comment":
      return /\n?<!--\s*slide\s*-->\n?/i;
    case "page-break":
      return /\n?(?:<!--\s*pagebreak\s*-->|\f)\n?/i;
    default:
      return /\n---\n/;
  }
}

/**
 * Split markdown into slides using specified separator
 */
export function splitIntoSlides(
  content: string,
  separator: SeparatorMode = "horizontal-rule"
): string[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const pattern = getSeparatorPattern(separator);

  let slides: string[];

  if (separator === "horizontal-rule") {
    // Special handling for --- to detect YAML front matter
    slides = normalized.split(pattern);

    // Check if first section is YAML front matter
    if (slides.length > 0 && slides[0].trim().startsWith("---")) {
      slides.shift();
    }
  } else if (
    separator === "heading" ||
    separator === "heading-1" ||
    separator === "heading-2" ||
    separator === "heading-3"
  ) {
    // For heading-based splitting, keep the heading with its content
    slides = normalized.split(pattern).filter((s) => s.trim());
  } else {
    slides = normalized.split(pattern);
  }

  return slides.filter((slide) => slide.trim().length > 0);
}

/**
 * Process markdown through plugins (preprocess only, no HTML rendering)
 */
export async function processMarkdown(
  slides: string[],
  options: MarkdownConvertOptions = {}
): Promise<{ markdown: string; beat: Partial<import("mulmocast").MulmoBeat> | null }[]> {
  // Resolve plugins
  const plugins: MarkdownPlugin[] = [];

  if (options.pluginNames) {
    for (const name of options.pluginNames) {
      const plugin = pluginRegistry.get(name);
      if (plugin) {
        plugins.push(plugin);
      } else {
        console.warn(`Plugin not found: ${name}`);
      }
    }
  }

  if (options.plugins) {
    plugins.push(...options.plugins);
  }

  // Load custom plugins from directory
  if (options.pluginDir) {
    await pluginRegistry.loadFromDir(options.pluginDir);
  }

  // Sort plugins by priority (higher first)
  plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const results: { markdown: string; beat: Partial<import("mulmocast").MulmoBeat> | null }[] = [];

  for (let i = 0; i < slides.length; i++) {
    let markdown = slides[i];
    const context: PluginContext = {
      slideIndex: i,
      totalSlides: slides.length,
      lang: "ja",
      metadata: {},
    };

    // Run preprocessors (transform markdown before conversion)
    for (const plugin of plugins) {
      if (plugin.preprocess) {
        markdown = plugin.preprocess(markdown, context);
      }
    }

    // Try to generate custom beat (e.g., mermaid → mermaid beat type)
    let beat: Partial<import("mulmocast").MulmoBeat> | null = null;
    for (const plugin of plugins) {
      if (plugin.toBeat) {
        const result = plugin.toBeat(markdown, context);
        if (result) {
          beat = result;
          break; // First plugin that returns a beat wins
        }
      }
    }

    results.push({ markdown, beat });
  }

  return results;
}

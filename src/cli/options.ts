import { langOption, type SupportedLang } from "../utils/lang.js";

// Common options for conversion commands
export const convertOptions = {
  ...langOption,
  g: {
    alias: "generate-text",
    type: "boolean" as const,
    description: "Generate narration text using LLM",
    default: false,
  },
};

// Options for action commands (movie, bundle, publish)
export const actionOptions = {
  ...langOption,
  f: {
    alias: "force",
    type: "boolean" as const,
    description: "Force regenerate MulmoScript",
    default: false,
  },
  g: {
    alias: "generate-text",
    type: "boolean" as const,
    description: "Generate narration text using LLM (only when generating)",
    default: false,
  },
  profile: {
    type: "string" as const,
    description: "ExtendedMulmoScript output profile name",
  },
  section: {
    type: "string" as const,
    description: "Filter beats by section name",
  },
  tags: {
    type: "string" as const,
    description: "Filter beats by tags (comma-separated)",
  },
};

// Movie-specific options (includes targetLang for audio language)
export const movieOptions = {
  ...actionOptions,
  t: {
    alias: "target-lang",
    type: "string" as const,
    description: "Target language for audio generation (e.g., ja, en, fr, de)",
  },
  c: {
    alias: "caption",
    type: "string" as const,
    description: "Caption/subtitle language (e.g., ja, en, fr, de)",
  },
};

// Marp-specific options
export const marpOptions = {
  ...convertOptions,
  theme: {
    type: "string" as const,
    description: "Path to custom theme CSS file",
  },
  "allow-local-files": {
    type: "boolean" as const,
    description: "Allow local file access in Marp",
    default: false,
  },
};

// Markdown-specific options
export const markdownOptions = {
  ...convertOptions,
  s: {
    alias: "separator",
    type: "string" as const,
    description: "Slide separator mode",
    choices: [
      "horizontal-rule",
      "heading",
      "heading-1",
      "heading-2",
      "heading-3",
      "blank-lines",
      "comment",
      "page-break",
    ] as const,
    default: "horizontal-rule",
  },
  mermaid: {
    type: "boolean" as const,
    description: "Convert mermaid code blocks to mermaid beat type",
    default: false,
  },
  directive: {
    type: "boolean" as const,
    description: "Remove Marp-style directives (<!-- _class: ... -->)",
    default: false,
  },
  layout: {
    type: "boolean" as const,
    description: "Auto-detect layout based on content (row-2, 2x2)",
    default: false,
  },
  style: {
    type: "string" as const,
    description: "Markdown slide style (e.g., corporate-blue, finance-green)",
  },
};

// Video convert options (with bundle)
export const videoConvertOptions = {
  ...convertOptions,
  bundle: {
    type: "boolean" as const,
    description: "Generate bundle with translations and TTS (default: true for video)",
    default: true,
  },
  "target-langs": {
    type: "string" as const,
    description: "Target languages for translation (comma-separated, e.g., ja,en)",
    default: "ja",
  },
};

export interface ActionOptions {
  force?: boolean;
  generateText?: boolean;
  lang?: SupportedLang;
  targetLang?: string;
  captionLang?: string;
  profile?: string;
  section?: string;
  tags?: string;
}

export const parseTags = (tags: string | undefined): string[] | undefined => {
  if (!tags) return undefined;
  return tags.split(",").map((t) => t.trim());
};

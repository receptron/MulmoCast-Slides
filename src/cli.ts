#!/usr/bin/env node

import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { convertMarp } from "./convert/marp.js";
import { convertMarkdown } from "./convert/markdown.js";
import { convertPptx } from "./convert/pptx.js";
import { convertPdf } from "./convert/pdf.js";
import { convertMovie } from "./convert/movie.js";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { langOption, type SupportedLang } from "./utils/lang.js";
import { detectFileType, getBasename, getKeynoteScriptPath } from "./actions/common.js";
import { runMulmoMovie } from "./actions/movie.js";
import { runMulmoBundle } from "./actions/bundle.js";
import { ensureMulmoScript } from "./actions/pipeline.js";
import { startPreviewServer } from "./actions/preview.js";

// Common options for conversion commands
const convertOptions = {
  ...langOption,
  g: {
    alias: "generate-text",
    type: "boolean" as const,
    description: "Generate narration text using LLM",
    default: false,
  },
};

// Options for action commands (movie, bundle, publish)
const actionOptions = {
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
const movieOptions = {
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
const marpOptions = {
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
const markdownOptions = {
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
const videoConvertOptions = {
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

async function runConvert(
  type: "marp" | "markdown" | "pptx" | "pdf" | "keynote" | "movie",
  file: string,
  options: {
    lang?: SupportedLang;
    generateText?: boolean;
    theme?: string;
    allowLocalFiles?: boolean;
    bundle?: boolean;
    targetLangs?: string[];
    separator?: string;
    mermaid?: boolean;
    directive?: boolean;
    layout?: boolean;
    style?: string;
  }
) {
  const inputPath = path.resolve(file);

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  switch (type) {
    case "marp":
      await convertMarp({
        inputPath,
        lang: options.lang,
        generateText: options.generateText,
        themePath: options.theme,
        allowLocalFiles: options.allowLocalFiles,
      });
      break;
    case "markdown":
      await convertMarkdown({
        inputPath,
        lang: options.lang,
        generateText: options.generateText,
        separator: options.separator as import("./convert/markdown-plugins/index.js").SeparatorMode,
        mermaid: options.mermaid,
        directive: options.directive,
        layout: options.layout,
        style: options.style,
      });
      break;
    case "pptx":
      await convertPptx({
        inputPath,
        lang: options.lang,
        generateText: options.generateText,
      });
      break;
    case "pdf":
      await convertPdf({
        inputPath,
        lang: options.lang,
        generateText: options.generateText,
      });
      break;
    case "movie":
      await convertMovie({
        inputPath,
        lang: options.lang,
        bundle: options.bundle,
        targetLangs: options.targetLangs,
      });
      break;
    case "keynote": {
      const scriptPath = getKeynoteScriptPath();
      execSync(`osascript "${scriptPath}" "${inputPath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      break;
    }
  }
}

interface ActionOptions {
  force?: boolean;
  generateText?: boolean;
  lang?: SupportedLang;
  targetLang?: string;
  captionLang?: string;
  profile?: string;
  section?: string;
  tags?: string;
}

const parseTags = (tags: string | undefined): string[] | undefined => {
  if (!tags) return undefined;
  return tags.split(",").map((t) => t.trim());
};

async function runAction(action: "movie" | "bundle", file: string, options: ActionOptions) {
  const inputPath = path.resolve(file);
  const basename = getBasename(inputPath);
  const outputDir = path.join("output", basename);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const mulmoScriptPath = await ensureMulmoScript(inputPath, {
    force: options.force,
    generateText: options.generateText,
    lang: options.lang,
    profile: options.profile,
    section: options.section,
    tags: parseTags(options.tags),
  });

  if (action === "movie") {
    await runMulmoMovie(mulmoScriptPath, outputDir, {
      targetLang: options.targetLang,
      captionLang: options.captionLang,
    });
  } else {
    await runMulmoBundle(mulmoScriptPath, outputDir);
  }

  console.log(`\n✓ ${action === "movie" ? "Movie" : "Bundle"} generation complete!`);
  console.log(`  Output directory: ${outputDir}`);
}

async function runUpload(basename: string) {
  dotenv.config({ quiet: true });

  const apiKey = process.env.MULMO_MEDIA_API_KEY;
  if (!apiKey) {
    console.error("Error: MULMO_MEDIA_API_KEY environment variable is not set");
    process.exit(1);
  }

  const outputDir = path.join("output", basename);
  if (!fs.existsSync(outputDir)) {
    console.error(`Output directory not found: ${outputDir}`);
    process.exit(1);
  }

  // Find bundle directory containing mulmo_view.json
  const entries = fs.readdirSync(outputDir, { withFileTypes: true });
  const bundleEntry = entries.find(
    (entry) =>
      entry.isDirectory() && fs.existsSync(path.join(outputDir, entry.name, "mulmo_view.json"))
  );

  if (!bundleEntry) {
    console.error(`mulmo_view.json not found in ${outputDir}`);
    process.exit(1);
  }

  const bundleDir = path.join(outputDir, bundleEntry.name);

  // Dynamic import to avoid loading upload code unnecessarily
  const { uploadBundleDir } = await import("./actions/upload.js");
  const result = await uploadBundleDir(bundleDir, apiKey);

  console.log(`\n✓ Upload complete!`);
  console.log(`  Upload path: ${result.uploadPath}`);
}

yargs(hideBin(process.argv))
  .scriptName("mulmo-slide")
  .usage("$0 <command> [options]")
  .command(
    "marp <file>",
    "Convert Marp markdown to MulmoScript",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Marp markdown file to convert",
          type: "string",
          demandOption: true,
        })
        .options(marpOptions);
    },
    async (argv) => {
      await runConvert("marp", argv.file, {
        lang: argv.l as SupportedLang | undefined,
        generateText: argv.g,
        theme: argv.theme,
        allowLocalFiles: argv["allow-local-files"],
      });
    }
  )
  .command(
    "markdown <file>",
    "Convert Markdown to MulmoScript (with separator and plugin options)",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Markdown file to convert",
          type: "string",
          demandOption: true,
        })
        .options(markdownOptions);
    },
    async (argv) => {
      await runConvert("markdown", argv.file, {
        lang: argv.l as SupportedLang | undefined,
        generateText: argv.g,
        separator: argv.s as string,
        mermaid: argv.mermaid,
        directive: argv.directive,
        layout: argv.layout,
        style: argv.style as string | undefined,
      });
    }
  )
  .command(
    "pptx <file>",
    "Convert PowerPoint to MulmoScript",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "PPTX file to convert",
          type: "string",
          demandOption: true,
        })
        .options(convertOptions);
    },
    async (argv) => {
      await runConvert("pptx", argv.file, {
        lang: argv.l as SupportedLang | undefined,
        generateText: argv.g,
      });
    }
  )
  .command(
    "pdf <file>",
    "Convert PDF to MulmoScript",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "PDF file to convert",
          type: "string",
          demandOption: true,
        })
        .options(convertOptions);
    },
    async (argv) => {
      await runConvert("pdf", argv.file, {
        lang: argv.l as SupportedLang | undefined,
        generateText: argv.g,
      });
    }
  )
  .command(
    "keynote <file>",
    "Convert Keynote to MulmoScript (macOS only)",
    (yargs) => {
      return yargs.positional("file", {
        describe: "Keynote file to convert",
        type: "string",
        demandOption: true,
      });
    },
    async (argv) => {
      await runConvert("keynote", argv.file, {});
    }
  )
  .command(
    "convert <file>",
    "Convert presentation or video to MulmoScript (auto-detect format)",
    (yargs) => {
      return yargs
        .positional("file", {
          describe:
            "Presentation or video file (.pptx, .md, .key, .pdf, .mp4, .mov, .mkv, .webm, .avi)",
          type: "string",
          demandOption: true,
        })
        .options(videoConvertOptions);
    },
    async (argv) => {
      const inputPath = path.resolve(argv.file);
      if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        process.exit(1);
      }
      const fileType = detectFileType(inputPath);
      const targetLangsStr = argv["target-langs"] as string | undefined;
      await runConvert(fileType, argv.file, {
        lang: argv.l as SupportedLang | undefined,
        generateText: argv.g,
        bundle: argv.bundle as boolean | undefined,
        targetLangs: targetLangsStr?.split(",").map((l) => l.trim()),
      });
    }
  )
  .command(
    "transcribe <file>",
    "Transcribe video to MulmoScript with translations and TTS",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Video file (.mp4, .mov, .mkv, .webm, .avi)",
          type: "string",
          demandOption: true,
        })
        .options(videoConvertOptions);
    },
    async (argv) => {
      const inputPath = path.resolve(argv.file);
      if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        process.exit(1);
      }
      const targetLangsStr = argv["target-langs"] as string | undefined;
      await runConvert("movie", argv.file, {
        lang: argv.l as SupportedLang | undefined,
        bundle: argv.bundle as boolean | undefined,
        targetLangs: targetLangsStr?.split(",").map((l) => l.trim()),
      });
    }
  )
  .command(
    "movie <file>",
    "Generate movie from presentation",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Presentation file (.pptx, .md, .key, .pdf)",
          type: "string",
          demandOption: true,
        })
        .options(movieOptions);
    },
    async (argv) => {
      await runAction("movie", argv.file, {
        force: argv.f,
        generateText: argv.g,
        lang: argv.l as SupportedLang | undefined,
        targetLang: argv.t,
        captionLang: argv.c,
        profile: argv.profile as string | undefined,
        section: argv.section as string | undefined,
        tags: argv.tags as string | undefined,
      });
    }
  )
  .command(
    "bundle <file>",
    "Generate MulmoViewer bundle from presentation",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Presentation file (.pptx, .md, .key, .pdf)",
          type: "string",
          demandOption: true,
        })
        .options(actionOptions);
    },
    async (argv) => {
      await runAction("bundle", argv.file, {
        force: argv.f,
        generateText: argv.g,
        lang: argv.l as SupportedLang | undefined,
        profile: argv.profile as string | undefined,
        section: argv.section as string | undefined,
        tags: argv.tags as string | undefined,
      });
    }
  )
  .command(
    "upload <basename>",
    "Upload bundle to MulmoCast server",
    (yargs) => {
      return yargs.positional("basename", {
        describe: "Basename of the bundle to upload",
        type: "string",
        demandOption: true,
      });
    },
    async (argv) => {
      await runUpload(argv.basename);
    }
  )
  .command(
    "publish <file>",
    "Generate movie + bundle + upload (full pipeline)",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Presentation file (.pptx, .md, .key, .pdf)",
          type: "string",
          demandOption: true,
        })
        .options(movieOptions);
    },
    async (argv) => {
      const inputPath = path.resolve(argv.file);
      const basename = getBasename(inputPath);
      const outputDir = path.join("output", basename);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const pipelineOptions = {
        force: argv.f,
        generateText: argv.g,
        lang: argv.l as SupportedLang | undefined,
        profile: argv.profile as string | undefined,
        section: argv.section as string | undefined,
        tags: parseTags(argv.tags as string | undefined),
      };

      // Step 1: Ensure MulmoScript
      const mulmoScriptPath = await ensureMulmoScript(inputPath, pipelineOptions);

      // Step 2: Generate movie
      console.log(`\n--- Movie ---`);
      await runMulmoMovie(mulmoScriptPath, outputDir, {
        targetLang: argv.t,
        captionLang: argv.c,
      });
      console.log(`✓ Movie generation complete!`);

      // Step 3: Generate bundle
      console.log(`\n--- Bundle ---`);
      await runMulmoBundle(mulmoScriptPath, outputDir);
      console.log(`✓ Bundle generation complete!`);

      // Step 4: Upload
      console.log(`\n--- Upload ---`);
      await runUpload(basename);

      console.log(`\n✓ Publish complete!`);
      console.log(`  Output directory: ${outputDir}`);
    }
  )
  .command(
    "extend",
    "Manage /extend Claude Code skill",
    (yargs) => {
      return yargs
        .command(
          "init",
          "Install /extend skill into current project (.claude/skills/extend/)",
          () => {},
          async () => {
            const { runExtendInit } = await import("./actions/extend-init.js");
            runExtendInit();
          }
        )
        .command(
          "validate <file>",
          "Validate an ExtendedMulmoScript JSON file against the schema",
          (yargs) => {
            return yargs.positional("file", {
              describe: "ExtendedMulmoScript JSON file to validate",
              type: "string",
              demandOption: true,
            });
          },
          async (argv) => {
            const { runExtendValidate } = await import("./actions/extend-validate.js");
            runExtendValidate(argv.file);
          }
        )
        .command(
          "scaffold <file>",
          "Create ExtendedMulmoScript skeleton from MulmoScript (no LLM needed)",
          (yargs) => {
            return yargs.positional("file", {
              describe: "MulmoScript JSON file to scaffold",
              type: "string",
              demandOption: true,
            });
          },
          async (argv) => {
            const { runExtendScaffold } = await import("./actions/extend-scaffold.js");
            runExtendScaffold(argv.file);
          }
        )
        .command(
          "merge <basename>",
          "Merge extended_script.json metadata into existing mulmo_view.json bundle",
          (yargs) => {
            return yargs.positional("basename", {
              describe: "Basename of the project (e.g., 2601.05047v2)",
              type: "string",
              demandOption: true,
            });
          },
          async (argv) => {
            const { runExtendMerge } = await import("./actions/extend-merge.js");
            runExtendMerge(argv.basename);
          }
        )
        .demandCommand(1, "Use 'mulmo-slide extend init|validate|scaffold|merge'");
    },
    () => {}
  )
  .command(
    "parse-md <file>",
    "Parse markdown structure and generate JSON Schemas for LLM planning",
    (yargs) => {
      return yargs.positional("file", {
        describe: "Markdown file to parse",
        type: "string",
        demandOption: true,
      });
    },
    async (argv) => {
      const { runParseMd } = await import("./actions/md-to-extended.js");
      runParseMd(argv.file);
    }
  )
  .command(
    "assemble-extended <file>",
    "Assemble ExtendedMulmoScript from presentation plan JSON",
    (yargs) => {
      return yargs.positional("file", {
        describe: "Presentation plan JSON file (presentation_plan.json)",
        type: "string",
        demandOption: true,
      });
    },
    async (argv) => {
      const { runAssembleExtended } = await import("./actions/md-to-extended.js");
      runAssembleExtended(argv.file);
    }
  )
  .command(
    "narrate <file>",
    "Generate narrated ExtendedMulmoScript from source file (full pipeline)",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Source file (.pdf, .pptx, .md, .key)",
          type: "string",
          demandOption: true,
        })
        .options({
          ...langOption,
          "scaffold-only": {
            type: "boolean" as const,
            description: "Only create scaffold (no LLM, for Claude Code handoff)",
            default: false,
          },
          f: {
            alias: "force",
            type: "boolean" as const,
            description: "Force regenerate MulmoScript even if it exists",
            default: false,
          },
          s: {
            alias: "separator",
            type: "string" as const,
            description: "Slide separator mode (for Markdown files)",
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
          },
          mermaid: {
            type: "boolean" as const,
            description: "Convert mermaid code blocks (for Markdown files)",
            default: false,
          },
        });
    },
    async (argv) => {
      const { runNarrate } = await import("./actions/narrate.js");
      await runNarrate(argv.file, {
        lang: argv.l as SupportedLang | undefined,
        scaffoldOnly: argv["scaffold-only"],
        force: argv.f,
        separator: argv.s as string | undefined,
        mermaid: argv.mermaid,
      });
    }
  )
  .command(
    "preview [port]",
    "Start MulmoViewer preview server",
    (yargs) => {
      return yargs.positional("port", {
        describe: "Port number for the server",
        type: "number",
        default: 3000,
      });
    },
    (argv) => {
      startPreviewServer(argv.port);
    }
  )
  .demandCommand(1, "You need to specify a command")
  .strict()
  .showHelpOnFail(false)
  .fail((msg, err) => {
    if (err) {
      console.error(`\n✗ Error: ${err.message}`);
    } else if (msg) {
      console.error(msg);
    }
    process.exit(1);
  })
  .help()
  .parse();

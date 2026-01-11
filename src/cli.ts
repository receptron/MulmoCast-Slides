#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { convertMarp } from "./convert/marp";
import { convertPptx } from "./convert/pptx";
import { convertPdf } from "./convert/pdf";
import { convertMovie } from "./convert/movie";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { langOption, type SupportedLang } from "./utils/lang";
import {
  detectFileType,
  getBasename,
  convertToMulmoScript,
  getMulmoScriptPath,
  getKeynoteScriptPath,
} from "./actions/common";
import { runMulmoMovie } from "./actions/movie";
import { runMulmoBundle } from "./actions/bundle";
import { startPreviewServer } from "./actions/preview";

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

// Options for action commands (movie, bundle)
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

async function runConvert(
  type: "marp" | "pptx" | "pdf" | "keynote" | "movie",
  file: string,
  options: {
    lang?: SupportedLang;
    generateText?: boolean;
    theme?: string;
    allowLocalFiles?: boolean;
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

async function runAction(
  action: "movie" | "bundle",
  file: string,
  options: {
    force?: boolean;
    generateText?: boolean;
    lang?: SupportedLang;
    targetLang?: string;
    captionLang?: string;
  }
) {
  const inputPath = path.resolve(file);

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const fileType = detectFileType(inputPath);
  const basename = getBasename(inputPath);
  const outputDir = path.join("output", basename);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const mulmoScriptPath = getMulmoScriptPath(basename);

  if (!options.force && fs.existsSync(mulmoScriptPath)) {
    console.log(`\n✓ Using existing MulmoScript: ${mulmoScriptPath}`);
  } else {
    await convertToMulmoScript(inputPath, fileType, {
      generateText: options.generateText,
      lang: options.lang,
    });

    if (!fs.existsSync(mulmoScriptPath)) {
      throw new Error(`MulmoScript not generated: ${mulmoScriptPath}`);
    }

    console.log(`\n✓ MulmoScript generated: ${mulmoScriptPath}`);
  }

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
  const dotenv = await import("dotenv");
  dotenv.config();

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
  const { uploadBundleDir } = await import("./actions/upload");
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
    "Convert any presentation or video to MulmoScript (auto-detect format)",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Presentation or video file (.pptx, .md, .key, .pdf, .mp4, .mov, .mkv, .webm, .avi)",
          type: "string",
          demandOption: true,
        })
        .options(convertOptions);
    },
    async (argv) => {
      const inputPath = path.resolve(argv.file);
      if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        process.exit(1);
      }
      const fileType = detectFileType(inputPath);
      await runConvert(fileType, argv.file, {
        lang: argv.l as SupportedLang | undefined,
        generateText: argv.g,
      });
    }
  )
  .command(
    "movie <file>",
    "Generate movie from presentation or video",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Presentation or video file (.pptx, .md, .key, .pdf, .mp4, .mov, .mkv, .webm, .avi)",
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
      });
    }
  )
  .command(
    "bundle <file>",
    "Generate MulmoViewer bundle from presentation or video",
    (yargs) => {
      return yargs
        .positional("file", {
          describe: "Presentation or video file (.pptx, .md, .key, .pdf, .mp4, .mov, .mkv, .webm, .avi)",
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

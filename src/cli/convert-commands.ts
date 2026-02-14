import type { Argv } from "yargs";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import type { SupportedLang } from "../utils/lang.js";
import type { SeparatorMode } from "../convert/markdown-plugins/index.js";
import { detectFileType, getKeynoteScriptPath } from "../actions/common.js";
import { convertMarp } from "../convert/marp.js";
import { convertMarkdown } from "../convert/markdown.js";
import { convertPptx } from "../convert/pptx.js";
import { convertPdf } from "../convert/pdf.js";
import { convertMovie } from "../convert/movie.js";
import { convertOptions, marpOptions, markdownOptions, videoConvertOptions } from "./options.js";

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
        separator: options.separator as SeparatorMode,
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

export function registerConvertCommands(yargs: Argv): Argv {
  return yargs
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
    );
}

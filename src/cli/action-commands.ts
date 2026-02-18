import type { Argv } from "yargs";
import * as path from "path";
import * as fs from "fs";
import type { SupportedLang } from "../utils/lang.js";
import { getBasename } from "../actions/common.js";
import { runMulmoMovie } from "../actions/movie.js";
import { runMulmoBundle } from "../actions/bundle.js";
import { ensureMulmoScript } from "../actions/pipeline.js";
import { type ActionOptions, actionOptions, movieOptions, parseTags } from "./options.js";

async function runAction(action: "movie" | "bundle", file: string, options: ActionOptions) {
  const inputPath = path.resolve(file);
  const basename = getBasename(inputPath);
  const outputDir = path.join("output", basename);

  if (options.theme && !fs.existsSync(path.resolve(options.theme))) {
    throw new Error(`Theme file not found: ${path.resolve(options.theme)}`);
  }

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
    themePath: options.theme,
    allowLocalFiles: options.allowLocalFiles,
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
  const { uploadBundleDir } = await import("../actions/upload.js");
  const result = await uploadBundleDir(bundleDir, apiKey);

  console.log(`\n✓ Upload complete!`);
  console.log(`  Upload path: ${result.uploadPath}`);
}

export function registerActionCommands(yargs: Argv): Argv {
  return yargs
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
          theme: argv.theme as string | undefined,
          allowLocalFiles: argv["allow-local-files"] as boolean | undefined,
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
          theme: argv.theme as string | undefined,
          allowLocalFiles: argv["allow-local-files"] as boolean | undefined,
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
      "Generate bundle and upload (internal)",
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
        const inputPath = path.resolve(argv.file);
        const basename = getBasename(inputPath);
        const outputDir = path.join("output", basename);
        const theme = argv.theme as string | undefined;

        if (theme && !fs.existsSync(path.resolve(theme))) {
          throw new Error(`Theme file not found: ${path.resolve(theme)}`);
        }

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Step 1: Ensure MulmoScript
        const mulmoScriptPath = await ensureMulmoScript(inputPath, {
          force: argv.f,
          generateText: argv.g,
          lang: argv.l as SupportedLang | undefined,
          profile: argv.profile as string | undefined,
          section: argv.section as string | undefined,
          tags: parseTags(argv.tags as string | undefined),
          themePath: theme,
          allowLocalFiles: argv["allow-local-files"] as boolean | undefined,
        });

        // Step 2: Generate bundle
        console.log(`\n--- Bundle ---`);
        await runMulmoBundle(mulmoScriptPath, outputDir);
        console.log(`✓ Bundle generation complete!`);

        // Step 3: Upload
        console.log(`\n--- Upload ---`);
        await runUpload(basename);

        console.log(`\n✓ Publish complete!`);
        console.log(`  Output directory: ${outputDir}`);
      }
    );
}

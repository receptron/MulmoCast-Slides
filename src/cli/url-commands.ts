import type { Argv } from "yargs";
import * as path from "path";
import * as fs from "fs";
import type { SupportedLang } from "../utils/lang.js";
import { langOption } from "../utils/lang.js";
import { EXPRESSION_NAMES } from "../utils/expression-styles.js";
import { runUrlToScript } from "../actions/url-to-script.js";
import { runMulmoMovie } from "../actions/movie.js";
import { runMulmoBundle } from "../actions/bundle.js";

const urlOptions = {
  ...langOption,
  e: {
    alias: "expression",
    type: "string" as const,
    choices: EXPRESSION_NAMES,
    description: "Expression style for presentation",
    default: "author",
  },
  style: {
    type: "string" as const,
    description: "Markdown visual style (e.g., corporate-blue)",
  },
  b: {
    alias: "beats",
    type: "number" as const,
    description: "Target beat count (approximate)",
  },
  f: {
    alias: "force",
    type: "boolean" as const,
    description: "Force regenerate MulmoScript",
    default: false,
  },
  movie: {
    type: "boolean" as const,
    description: "Also generate movie",
    default: false,
  },
  bundle: {
    type: "boolean" as const,
    description: "Also generate bundle",
    default: false,
  },
};

export function registerUrlCommands(yargs: Argv): Argv {
  return yargs.command(
    "url <url>",
    "Generate MulmoScript from a web article URL",
    (yargs) => {
      return yargs
        .positional("url", {
          describe: "URL of the web article",
          type: "string",
          demandOption: true,
        })
        .options(urlOptions);
    },
    async (argv) => {
      const scriptPath = await runUrlToScript(argv.url, {
        expression: argv.e,
        lang: argv.l as SupportedLang | undefined,
        style: argv.style,
        force: argv.f,
        beats: argv.b,
      });

      if (argv.movie || argv.bundle) {
        const basename = path.basename(path.dirname(scriptPath));
        const outputDir = path.join("output", basename);

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        if (argv.movie) {
          console.log("\n--- Movie ---");
          await runMulmoMovie(scriptPath, outputDir);
          console.log("✓ Movie generation complete!");
        }

        if (argv.bundle) {
          console.log("\n--- Bundle ---");
          await runMulmoBundle(scriptPath, outputDir);
          console.log("✓ Bundle generation complete!");
        }

        console.log(`  Output directory: ${outputDir}`);
      }
    }
  );
}

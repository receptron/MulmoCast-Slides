import type { Argv } from "yargs";
import type { SupportedLang } from "../utils/lang.js";
import { langOption } from "../utils/lang.js";
import { startPreviewServer } from "../actions/preview.js";

export function registerMiscCommands(yargs: Argv): Argv {
  return yargs
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
        const { runNarrate } = await import("../actions/narrate.js");
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
        const { runParseMd } = await import("../actions/md-to-extended.js");
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
        const { runAssembleExtended } = await import("../actions/md-to-extended.js");
        runAssembleExtended(argv.file);
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
    );
}

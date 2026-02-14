import type { Argv } from "yargs";

export function registerExtendCommands(yargs: Argv): Argv {
  return yargs.command(
    "extend",
    "Manage /extend Claude Code skill",
    (yargs) => {
      return yargs
        .command(
          "init",
          "Install /extend skill into current project (.claude/skills/extend/)",
          () => {},
          async () => {
            const { runExtendInit } = await import("../actions/extend-init.js");
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
            const { runExtendValidate } = await import("../actions/extend-validate.js");
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
            const { runExtendScaffold } = await import("../actions/extend-scaffold.js");
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
            const { runExtendMerge } = await import("../actions/extend-merge.js");
            runExtendMerge(argv.basename);
          }
        )
        .demandCommand(1, "Use 'mulmo-slide extend init|validate|scaffold|merge'");
    },
    () => {}
  );
}

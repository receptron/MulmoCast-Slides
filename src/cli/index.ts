#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config({ quiet: true });

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { registerConvertCommands } from "./convert-commands.js";
import { registerActionCommands } from "./action-commands.js";
import { registerExtendCommands } from "./extend-commands.js";
import { registerMiscCommands } from "./misc-commands.js";
import { registerUrlCommands } from "./url-commands.js";

const cli = [
  registerConvertCommands,
  registerActionCommands,
  registerExtendCommands,
  registerMiscCommands,
  registerUrlCommands,
].reduce(
  (y, register) => register(y),
  yargs(hideBin(process.argv)).scriptName("mulmo-slide").usage("$0 <command> [options]")
);

cli
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

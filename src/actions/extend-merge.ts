import * as fs from "fs";
import * as path from "path";
import { mergeExtendedMetadata } from "../utils/extended-bundle-merge.js";

export function runExtendMerge(basename: string): void {
  const scriptsDir = path.join("scripts", basename);
  const extendedPath = path.join(scriptsDir, "extended_script.json");

  if (!fs.existsSync(extendedPath)) {
    console.error(`✗ Not found: ${extendedPath}`);
    process.exit(1);
  }

  const bundleDir = path.join("output", basename, basename);
  const viewJsonPath = path.join(bundleDir, "mulmo_view.json");

  if (!fs.existsSync(viewJsonPath)) {
    console.error(`✗ Not found: ${viewJsonPath}`);
    console.error(`  Run 'mulmo-slide bundle' first to generate the bundle.`);
    process.exit(1);
  }

  mergeExtendedMetadata(bundleDir, scriptsDir);

  console.log(`✓ Merged extended metadata into ${viewJsonPath}`);
  console.log(`  Source: ${extendedPath}`);
}

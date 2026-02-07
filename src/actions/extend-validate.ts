import * as fs from "fs";
import * as path from "path";
import { extendedScriptSchema } from "@mulmocast/extended-types";

interface ValidationSummary {
  beatCount: number;
  hasScriptMeta: boolean;
  metaCoverage: number;
  sections: string[];
}

const summarizeScript = (data: unknown): ValidationSummary => {
  const script = data as Record<string, unknown>;
  const beats = script.beats as Record<string, unknown>[];
  const beatsWithMeta = beats.filter((b) => b.meta);
  const sections = [
    ...new Set(
      beats.map((b) => (b.meta as Record<string, unknown> | undefined)?.section).filter(Boolean)
    ),
  ] as string[];

  return {
    beatCount: beats.length,
    hasScriptMeta: !!script.scriptMeta,
    metaCoverage: beats.length > 0 ? Math.round((beatsWithMeta.length / beats.length) * 100) : 0,
    sections,
  };
};

const formatZodError = (error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string => {
  const lines = error.issues.map((issue) => {
    const pathStr = issue.path.length > 0 ? issue.path.map((p) => String(p)).join(".") : "(root)";
    return `  - ${pathStr}: ${issue.message}`;
  });
  return lines.join("\n");
};

export const runExtendValidate = (filePath: string): void => {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  let data: unknown;
  try {
    const content = fs.readFileSync(resolvedPath, "utf-8");
    data = JSON.parse(content);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Failed to parse JSON: ${message}`);
    process.exit(1);
  }

  const result = extendedScriptSchema.safeParse(data);

  if (!result.success) {
    console.error(`\n✗ Validation failed: ${resolvedPath}\n`);
    console.error(formatZodError(result.error));
    process.exit(1);
  }

  const summary = summarizeScript(data);

  console.log(`\n✓ Valid ExtendedScript: ${resolvedPath}`);
  console.log(`  Beats: ${summary.beatCount}`);
  console.log(`  ScriptMeta: ${summary.hasScriptMeta ? "yes" : "no"}`);
  console.log(`  Meta coverage: ${summary.metaCoverage}%`);
  if (summary.sections.length > 0) {
    console.log(`  Sections: ${summary.sections.join(", ")}`);
  }
};

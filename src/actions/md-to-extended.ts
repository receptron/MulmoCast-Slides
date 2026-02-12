/**
 * Markdown → ExtendedMulmoScript pipeline
 *
 * Step 1: Generate JSON Schema from Zod (every run) + parse markdown
 * Step 3: Assemble ExtendedMulmoScript from presentation plan
 * Step 4: Validate against ExtendedMulmoScript schema
 *
 * Step 2 (LLM presentation planning) is handled by the /md-to-mulmo skill.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { toJSONSchema, fromJSONSchema } from "zod";
import { currentMulmoScriptVersion } from "mulmocast";
import { extendedMulmoScriptSchema } from "@mulmocast/extended-types";
import type {
  ExtendedMulmoScript,
  ExtendedMulmoBeat,
  BeatVariant,
} from "@mulmocast/extended-types";
import { parseMarkdown } from "../utils/markdown-parser.js";
import { readJsonFile, writeJsonFile } from "./common.js";

// --- Types for the presentation plan (derived from JSON Schema at runtime) ---

interface BeatPlan {
  id: string;
  sourceSections: string[];
  slideMarkdown: string;
  narration: string;
  shortNarration?: string | null;
  isCore: boolean;
  meta: {
    tags?: string[];
    section?: string;
    context?: string;
    keywords?: string[];
    expectedQuestions?: string[];
  };
}

interface PresentationPlan {
  lang: string;
  title?: string;
  scriptMeta: Record<string, unknown>;
  beats: BeatPlan[];
}

// --- Step 1A: Generate JSON Schema files ---

const PLAN_SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../references/presentation-plan.schema.json"
);

export const generateSchemas = (
  outputDir: string
): { extendedSchemaPath: string; planSchemaPath: string } => {
  const extendedSchema = toJSONSchema(extendedMulmoScriptSchema);
  const extendedSchemaPath = path.join(outputDir, "extended-script.schema.json");
  writeJsonFile(extendedSchemaPath, extendedSchema);

  // Copy plan schema to output dir
  const planSchemaPath = path.join(outputDir, "presentation-plan.schema.json");
  const planSchema = readJsonFile<unknown>(PLAN_SCHEMA_PATH);
  writeJsonFile(planSchemaPath, planSchema);

  return { extendedSchemaPath, planSchemaPath };
};

// --- Step 1B: Parse markdown ---

export const runParseMd = (inputPath: string): void => {
  const resolvedPath = path.resolve(inputPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(resolvedPath, "utf-8");
  const basename = path.basename(resolvedPath, path.extname(resolvedPath));
  const outputDir = path.join("scripts", basename);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Step 1A: Generate schemas
  console.log("Generating JSON Schemas...");
  const { extendedSchemaPath, planSchemaPath } = generateSchemas(outputDir);
  console.log(`  ExtendedMulmoScript schema: ${extendedSchemaPath}`);
  console.log(`  Plan schema: ${planSchemaPath}`);

  // Step 1B: Parse markdown
  console.log("Parsing markdown structure...");
  const parsed = parseMarkdown(markdown);
  const parsedPath = path.join(outputDir, "parsed_structure.json");
  writeJsonFile(parsedPath, parsed);

  const elementCount = parsed.sections.reduce((sum, s) => sum + s.elements.length, 0);
  console.log(`\n✓ Markdown parsed: ${parsedPath}`);
  console.log(`  Sections: ${parsed.sections.length}`);
  console.log(`  Elements: ${elementCount}`);
  console.log(`  Frontmatter: ${parsed.frontmatter ? "yes" : "no"}`);
  console.log(`\nNext: Run /md-to-mulmo skill to create presentation_plan.json`);
};

// --- Step 3: Assemble ExtendedMulmoScript from presentation plan ---

const buildVariants = (beat: BeatPlan): Record<string, BeatVariant> | undefined => {
  if (beat.isCore) {
    if (beat.shortNarration != null) {
      return { short: { text: beat.shortNarration } };
    }
    return undefined;
  }
  // Non-core beats are skipped in short version
  return { short: { skip: true } };
};

const buildExtendedMulmoBeat = (beat: BeatPlan): ExtendedMulmoBeat => {
  const variants = buildVariants(beat);
  const result: ExtendedMulmoBeat = {
    id: beat.id,
    text: beat.narration,
    image: {
      type: "markdown",
      markdown: beat.slideMarkdown.split("\n"),
    },
    meta: beat.meta,
  };

  if (variants) {
    result.variants = variants;
  }

  return result;
};

export const assembleExtendedMulmoScript = (plan: PresentationPlan): ExtendedMulmoScript => {
  const coreCount = plan.beats.filter((b) => b.isCore).length;
  const optionalCount = plan.beats.length - coreCount;

  // Build as input (without defaulted fields) and parse through schema to fill defaults
  const input = {
    $mulmocast: { version: currentMulmoScriptVersion },
    lang: plan.lang,
    ...(plan.title ? { title: plan.title } : {}),
    outputProfiles: {
      detailed: {
        name: "Detailed",
        description: `Full presentation (${plan.beats.length} slides)`,
      },
      short: {
        name: "Short",
        description: `Core content only (${coreCount} slides, ${optionalCount} skipped)`,
      },
    },
    scriptMeta: plan.scriptMeta,
    beats: plan.beats.map(buildExtendedMulmoBeat),
  };

  const result = extendedMulmoScriptSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Assembly produced invalid ExtendedMulmoScript: ${JSON.stringify(result.error.format())}`
    );
  }

  return result.data as ExtendedMulmoScript;
};

// --- Step 4: Validate ---

export const validateExtendedMulmoScript = (
  data: unknown
): { success: true; data: ExtendedMulmoScript } | { success: false; errors: string } => {
  const result = extendedMulmoScriptSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as ExtendedMulmoScript };
  }
  return { success: false, errors: JSON.stringify(result.error.format(), null, 2) };
};

// --- Step 3: Validate presentation plan ---

const loadPlanValidator = () => {
  const planSchemaJson = readJsonFile<Record<string, unknown>>(PLAN_SCHEMA_PATH);
  return fromJSONSchema(planSchemaJson);
};

export const validatePresentationPlan = (
  data: unknown
): { success: true; data: PresentationPlan } | { success: false; errors: string } => {
  const validator = loadPlanValidator();
  const result = validator.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as PresentationPlan };
  }
  return { success: false, errors: JSON.stringify(result.error.format(), null, 2) };
};

// --- CLI entry: assemble-extended ---

export const runAssembleExtended = (inputPath: string): void => {
  const resolvedPath = path.resolve(inputPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // Load and validate plan
  console.log("Loading presentation plan...");
  const planData = readJsonFile<unknown>(resolvedPath);
  const planResult = validatePresentationPlan(planData);

  if (!planResult.success) {
    console.error("Presentation plan validation failed:");
    console.error(planResult.errors);
    process.exit(1);
  }

  const plan = planResult.data;
  console.log(`  Beats: ${plan.beats.length} (core: ${plan.beats.filter((b) => b.isCore).length})`);

  // Assemble ExtendedMulmoScript
  console.log("Assembling ExtendedMulmoScript...");
  const extended = assembleExtendedMulmoScript(plan);

  // Validate
  const validationResult = validateExtendedMulmoScript(extended);
  if (!validationResult.success) {
    console.error("ExtendedMulmoScript validation failed:");
    console.error(validationResult.errors);
    process.exit(1);
  }

  // Write output
  const dir = path.dirname(resolvedPath);
  const outputPath = path.join(dir, "extended_script.json");
  writeJsonFile(outputPath, validationResult.data);

  const coreCount = plan.beats.filter((b) => b.isCore).length;
  console.log(`\n✓ ExtendedMulmoScript generated: ${outputPath}`);
  console.log(`  Total beats: ${plan.beats.length}`);
  console.log(`  Core (all profiles): ${coreCount}`);
  console.log(`  Detailed-only: ${plan.beats.length - coreCount}`);
  console.log(`  Profiles: detailed, short`);
  console.log(`\nNext steps:`);
  console.log(`  npx mulmocast-preprocessor ${outputPath} -o ${dir}/<basename>.json`);
};

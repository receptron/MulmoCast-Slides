import * as fs from "fs";
import * as path from "path";
import { mulmoScriptSchema } from "@mulmocast/types";
import { puppeteerCrawlerAgent } from "mulmocast";
import { slideStyles } from "mulmocast/data";
import { mergeScripts } from "mulmocast/tools/complete_script";
import type { AgentFunctionContext } from "graphai";
import type { SupportedLang } from "../utils/lang.js";
import { expressionStyles, EXPRESSION_NAMES } from "../utils/expression-styles.js";
import { getSlideSchemaForPrompt } from "../utils/slide-schema.js";
import { getOpenAIClient, extractResponseContent, getLanguageName } from "../utils/llm.js";
import { sanitizeBasename, writeJsonFile, formatZodError } from "./common.js";

export interface UrlToScriptOptions {
  expression?: string;
  lang?: SupportedLang;
  style?: string;
  force?: boolean;
  beats?: number;
}

interface ArticleData {
  url: string;
  title: string | null;
  textContent: string | null;
}

const MAX_RETRY_COUNT = 3;
const TITLE_MAX_LENGTH = 30;

export function generateBasename(title: string | null, dateStr: string): string {
  const sanitizedTitle = title ? sanitizeBasename(title).slice(0, TITLE_MAX_LENGTH) : "article";
  return `${dateStr}-${sanitizedTitle}`;
}

function buildArticleText(article: ArticleData): string {
  const parts: string[] = [];
  parts.push(`URL: ${article.url}`);
  if (article.title) {
    parts.push(`Title: ${article.title}`);
  }
  parts.push("");
  parts.push(article.textContent ?? "");
  return parts.join("\n");
}

async function fetchArticle(url: string): Promise<ArticleData> {
  console.log(`  Fetching article from: ${url}`);

  const agentFn = puppeteerCrawlerAgent.agent;
  const result = await agentFn({
    namedInputs: { url },
    params: {},
    inputs: [],
    debugInfo: { retry: 0, nodeId: "url-fetch", agentId: "puppeteerCrawlerAgent", verbose: false },
    filterParams: {},
  } as unknown as AgentFunctionContext);

  const data = (result as { data?: ArticleData }).data;
  if (!data?.textContent) {
    throw new Error(`Failed to extract content from URL: ${url}`);
  }

  return data;
}

async function checkArticleQuality(articleText: string): Promise<void> {
  console.log("  Checking article quality...");

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a content quality checker. Determine if the given text is a real article with enough content to create a presentation.

Respond with JSON: { "sufficient": true/false, "reason": "<explanation>" }

Mark as INSUFFICIENT if:
- The text is mostly navigation, ads, or boilerplate
- The text is a login page, 404 error, or paywall
- The text has less than 100 words of actual content
- The text is garbled or not readable`,
      },
      { role: "user", content: articleText.slice(0, 3000) },
    ],
    response_format: { type: "json_object" },
  });

  const content = extractResponseContent(response);
  const result = JSON.parse(content) as { sufficient: boolean; reason: string };

  if (!result.sufficient) {
    throw new Error(`Article content insufficient: ${result.reason}`);
  }

  console.log("  ✓ Article quality check passed");
}

function buildBeatsPrompt(articleText: string, options: UrlToScriptOptions): string {
  const styleName = options.expression ?? "author";
  const style = expressionStyles[styleName];
  if (!style) {
    throw new Error(
      `Unknown expression style: ${styleName}. Available: ${EXPRESSION_NAMES.join(", ")}`
    );
  }

  const lang = options.lang ?? "en";
  const languageName = getLanguageName(lang);

  const beatsHint = options.beats ? `\nTarget approximately ${options.beats} beats.` : "";

  const slideSchema = getSlideSchemaForPrompt();
  const promptWithSchema = style.systemPrompt.replace("{{SLIDE_SCHEMA}}", slideSchema);

  return `${promptWithSchema}

## Language

Write all narration text in ${languageName} (lang code: "${lang}").
${beatsHint}

## Article Content

${articleText}`;
}

async function generateBeatsWithRetry(
  articleText: string,
  options: UrlToScriptOptions
): Promise<Record<string, unknown>> {
  const prompt = buildBeatsPrompt(articleText, options);
  const client = getOpenAIClient();
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt++) {
    console.log(`  Generating beats (attempt ${attempt}/${MAX_RETRY_COUNT})...`);

    const retryHint =
      attempt > 1
        ? `\n\nPrevious attempt failed validation:\n${lastError}\n\nPlease fix these issues.`
        : "";

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: prompt + retryHint },
        {
          role: "user",
          content: "Generate the MulmoScript presentation based on the article above.",
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = extractResponseContent(response);
    const parsed = JSON.parse(content) as Record<string, unknown>;

    const result = mulmoScriptSchema.safeParse(parsed);
    if (result.success) {
      console.log("  ✓ MulmoScript validation passed");
      return result.data as Record<string, unknown>;
    }

    lastError = formatZodError(result.error);
    console.warn(`  ✗ Validation failed (attempt ${attempt}): ${lastError}`);
  }

  throw new Error(
    `Failed to generate valid MulmoScript after ${MAX_RETRY_COUNT} attempts:\n${lastError}`
  );
}

const SLIDE_STYLE_NAMES = Object.keys(slideStyles);

function applySlideStyle(
  mulmoScript: Record<string, unknown>,
  styleName: string | undefined
): Record<string, unknown> {
  if (!styleName) return mulmoScript;

  const styleData = slideStyles[styleName as keyof typeof slideStyles];
  if (!styleData) {
    console.warn(`Unknown slide style: ${styleName}. Available: ${SLIDE_STYLE_NAMES.join(", ")}`);
    return mulmoScript;
  }

  return mergeScripts(styleData, mulmoScript) as Record<string, unknown>;
}

export async function runUrlToScript(url: string, options: UrlToScriptOptions): Promise<string> {
  // Step 1: Fetch article
  const article = await fetchArticle(url);
  console.log(`  ✓ Fetched: ${article.title ?? "(no title)"}`);

  // Step 2: Generate basename and paths
  const today = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("");
  const basename = generateBasename(article.title, dateStr);
  const scriptDir = path.join("scripts", basename);
  const scriptPath = path.join(scriptDir, `${basename}.json`);

  // Check existing
  if (!options.force && fs.existsSync(scriptPath)) {
    console.log(`\n✓ Using existing MulmoScript: ${scriptPath}`);
    return scriptPath;
  }

  // Step 3: Save article text
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }
  const articleText = buildArticleText(article);
  fs.writeFileSync(path.join(scriptDir, "article.txt"), articleText, "utf-8");
  console.log(`  ✓ Saved article.txt`);

  // Step 4: Quality check
  await checkArticleQuality(articleText);

  // Step 5: Generate beats via LLM
  const mulmoScript = await generateBeatsWithRetry(articleText, options);

  // Step 6: Apply slide style
  const styled = applySlideStyle(mulmoScript, options.style);

  // Step 7: Save MulmoScript
  writeJsonFile(scriptPath, styled);
  console.log(`\n✓ MulmoScript saved: ${scriptPath}`);

  const beats = (styled.beats as unknown[]) ?? [];
  console.log(`  Beats: ${beats.length}`);

  return scriptPath;
}

import { z } from "zod";
import { slideLayoutSchema, contentBlockSchema } from "@mulmocast/types/lib/slide.js";

let cachedSchema: string | null = null;

function buildContentBlockReference(): string {
  const schema = z.toJSONSchema(contentBlockSchema, { target: "draft-7" });
  return JSON.stringify(schema, null, 2);
}

function buildSlideLayoutReference(): string {
  const schema = z.toJSONSchema(slideLayoutSchema, { target: "draft-7" });
  return JSON.stringify(schema, null, 2);
}

export function getSlideSchemaForPrompt(): string {
  if (cachedSchema) return cachedSchema;

  const layoutRef = buildSlideLayoutReference();
  const blockRef = buildContentBlockReference();

  cachedSchema = [
    "### Slide Layout Schema (JSON Schema)",
    "",
    "Each beat's `image.slide` must conform to one of these layouts:",
    "",
    "```json",
    layoutRef,
    "```",
    "",
    "### Content Block Schema (JSON Schema)",
    "",
    "Content blocks used in `columns[].content`, `left.content`, `right.content`, etc.:",
    "",
    "```json",
    blockRef,
    "```",
  ].join("\n");

  return cachedSchema;
}

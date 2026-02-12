# /md-to-mulmo - Markdown to ExtendedMulmoScript Conversion

Convert a structured markdown document into an ExtendedMulmoScript with intelligent beat allocation, narration, metadata, and variant support for detailed/short output profiles.

## Invocation

```
/md-to-mulmo <markdown file path>
```

## CLI Commands Overview

| Command | Package | Purpose | Input |
|---------|---------|---------|-------|
| `mulmo-slide` (or `yarn cli`) | `@mulmocast/slide` | Convert source files, parse markdown, assemble ExtendedMulmoScript | `.md`, `.pdf`, `.pptx`, etc. |
| `mulmo` | `mulmocast` | Generate movie/PDF/audio from MulmoScript | `{basename}.json` |
| `mulmocast-preprocessor` | `mulmocast-preprocessor` | Convert ExtendedMulmoScript → MulmoScript, query, summarize | `extended_script.json` |

### CLI prefix for mulmo-slide

Determine the correct CLI command prefix:
- If `package.json` exists in the project root and its `name` is `"@mulmocast/slide"` → use `yarn cli`
- Otherwise → use `npx mulmo-slide`
- NEVER create a `package.json` for this purpose

Use this prefix (referred to as `{cli}` below) for all `mulmo-slide` CLI calls.

## Instructions

### Step 1: Parse Markdown and Generate Schemas

Run the parse-md command to extract document structure and generate JSON Schemas:

```bash
{cli} parse-md <markdown file>
```

This produces in `scripts/{basename}/`:
- `parsed_structure.json` — structured markdown sections with typed elements
- `extended-script.schema.json` — ExtendedMulmoScript JSON Schema (generated from Zod every run)
- `presentation-plan.schema.json` — intermediate format JSON Schema

### Step 2: Read Inputs

Use the Read tool to read:

1. `scripts/{basename}/parsed_structure.json`
2. `scripts/{basename}/presentation-plan.schema.json`
3. The original markdown file (for full context)

### Step 3: Create Presentation Plan

Analyze the parsed structure and create `presentation_plan.json` conforming to the plan schema.

**Key decisions to make:**

1. **Beat allocation** (sections ≠ beats):
   - Multiple sections can be consolidated into one beat
   - One dense section can be split across multiple beats
   - Aim for 8-15 beats for a typical document
   - Each beat should be a coherent, presentable unit

2. **Slide content** (`slideMarkdown`):
   - Concise, presentation-ready markdown for the visual slide
   - NOT a copy of the source — distill to key points, headings, bullet lists
   - Include tables, mermaid diagrams, code blocks when they are the focus
   - Each slide should be understandable at a glance

3. **Narration** (`narration`):
   - Natural spoken language explaining the slide content
   - Add context and insight beyond what's on the slide
   - Write in the document's language (specified by `lang`)

4. **Core vs optional** (`isCore` / `shortNarration`):
   - `isCore: true`: Essential beats included in ALL output profiles
   - `isCore: false`: Detailed-only beats, skipped in short version
   - `shortNarration`: Condensed narration for short profile (null = skip beat in short)
   - Typical: 60-70% core, 30-40% optional
   - Introduction and conclusion beats should always be core

5. **Script metadata** (`scriptMeta`):
   - `audience`: Target audience
   - `goals`: 2-4 learning objectives
   - `keywords`: 5-10 main keywords
   - `background`: Theme overview
   - `references`: Extract URLs from source, categorize as web/code/document/video
   - `faq`: 2-4 questions with answers

6. **Beat metadata** (`meta`):
   - `section`: Logical section (lowercase-kebab-case, consecutive beats with same section stay grouped)
   - `tags`: Content type tags (intro, overview, definition, example, code, diagram, data, table, comparison, summary, conclusion)
   - `context`: Background info for AI features — most important field. Add supplementary information beyond what's in the slide.
   - `keywords`: 2-5 beat-specific terms
   - `expectedQuestions`: 1-3 audience questions

**Output format:**

```json
{
  "lang": "ja",
  "title": "Presentation Title",
  "scriptMeta": {
    "audience": "...",
    "goals": ["..."],
    "keywords": ["..."],
    "background": "...",
    "references": [{ "type": "web", "url": "...", "title": "..." }],
    "faq": [{ "question": "...", "answer": "..." }]
  },
  "beats": [
    {
      "id": "beat-1",
      "sourceSections": ["sec-0", "sec-1"],
      "slideMarkdown": "# Introduction\n\n- Key point 1\n- Key point 2",
      "narration": "Full narration text...",
      "shortNarration": "Condensed version...",
      "isCore": true,
      "meta": {
        "section": "introduction",
        "tags": ["intro"],
        "context": "Background info...",
        "keywords": ["term1"],
        "expectedQuestions": ["Why is this important?"]
      }
    }
  ]
}
```

Write this to `scripts/{basename}/presentation_plan.json`.

### Step 4: Assemble and Validate

Run the assemble command to convert the plan to ExtendedMulmoScript:

```bash
{cli} assemble-extended scripts/{basename}/presentation_plan.json
```

This:
- Validates the plan against the JSON Schema (z.fromJSONSchema)
- Converts `isCore`/`shortNarration` → `variants`/`outputProfiles`
- Validates the result against ExtendedMulmoScript schema
- Outputs `scripts/{basename}/extended_script.json`

If validation fails, fix the plan and re-run.

### Step 5: Post-processing

Generate MulmoScript from ExtendedMulmoScript:

```bash
npx mulmocast-preprocessor scripts/{basename}/extended_script.json -o scripts/{basename}/{basename}.json
```

### Step 6: Summary

Display to the user:
- Total beats, core beats, optional beats
- Sections identified
- Output profiles available (detailed, short)
- File paths for extended_script.json and {basename}.json
- Next steps (e.g., `npx mulmo movie scripts/{basename}/{basename}.json`)

## Quality Guidelines

- **slideMarkdown**: Presentation-ready, not a dump of the source. Think "what would go on a slide."
- **narration**: Natural spoken language. Add insight beyond the slide text.
- **context field**: Most important metadata. Don't restate the slide — add background, related concepts, real-world examples.
- **section naming**: lowercase-kebab-case, consistent across beats.
- **isCore judgment**: Introduction, key findings, and conclusion are always core. Examples, deep-dives, and supplementary content can be optional.
- **shortNarration**: If a core beat needs the same text in both profiles, omit shortNarration (it defaults to the full narration).

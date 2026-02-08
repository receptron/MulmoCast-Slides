# /narrate - Source File to Narrated ExtendedScript

Convert any supported source file (PDF, PPTX, Markdown, Keynote) into a validated ExtendedScript with AI-generated narration and metadata. This is the main entry point for the full pipeline.

## Invocation

```
/narrate <source file path>
```

Supported formats: `.pdf`, `.pptx`, `.md`, `.key`

## CLI Commands Overview

This project uses multiple CLI tools. Do NOT confuse them:

| Command | Package | Purpose | Input |
|---------|---------|---------|-------|
| `mulmo-slide` (or `yarn cli`) | `@mulmocast/slide` | Convert source files to MulmoScript, scaffold ExtendedScript | Presentation files (.pdf, .pptx, .md, .key) |
| `mulmo` | `mulmocast` | Generate movie/PDF/audio from MulmoScript | `{basename}.json` |
| `mulmocast-preprocessor` | `mulmocast-preprocessor` | Convert ExtendedScript → MulmoScript, query, summarize | `extended_script.json` |

**IMPORTANT**: `mulmo-slide movie` and `mulmo movie` are DIFFERENT commands. Use `npx mulmo movie` (not `mulmo-slide`) when generating video from a MulmoScript JSON.

**NOTE**: MulmoScript files are named `{basename}.json` (e.g., `scripts/paper/paper.json`), NOT `mulmo_script.json`.

### CLI prefix for mulmo-slide

Determine the correct CLI command prefix:
- If `package.json` exists in the project root and its `name` is `"@mulmocast/slide"` (i.e., developing MulmoCast-Slides itself) → use `yarn cli`
- Otherwise (including when no `package.json` exists) → use `npx mulmo-slide`
- NEVER create a `package.json` file for this purpose

Use this prefix (referred to as `{cli}` below) for `mulmo-slide` CLI calls in the steps.

## Instructions

### Step 1: Scaffold ExtendedScript

Run the narrate CLI with `--scaffold-only` to convert the source and create the ExtendedScript skeleton in one step:

```bash
{cli} narrate <file> --scaffold-only
```

This automatically detects the file format, converts to MulmoScript, and creates `scripts/{basename}/extended_script.json` with:
- Beat IDs assigned
- Empty metadata fields ready for AI analysis
- Extracted texts imported as notes (for PDF)

If the MulmoScript already exists and you want to regenerate it, add `-f`:
```bash
{cli} narrate <file> --scaffold-only -f
```

Confirm the output:
- How many beats were scaffolded
- Whether notes were imported from extracted texts

### Step 2: Read Inputs

Use the Read tool (not bash/node commands) to read the following files:

1. `scripts/{basename}/extended_script.json` (the scaffolded output from Step 1)
2. `.claude/skills/narrate/references/extended-script-schema.md`
3. The original source `.md` file (if Markdown, for speaker notes and structure)
4. For image-based slides (PDF/PPTX), read the slide images to understand visual content

### Step 3: Analyze Content

Analyze the MulmoScript beats, extracted texts, and source file to understand:

- The overall theme and purpose
- The target audience
- The logical structure (sections, flow)
- Content types in each slide (text, code, diagrams, tables, data)
- URLs and external references
- Key terminology and concepts

For slides with images, read the slide images to understand visual content that may not be in extracted text.

### Step 4: Generate Narration and Metadata

Based on the analysis, generate:

**`scriptMeta`** (script-level):
- `background`: 1-2 sentence overview of the theme
- `audience`: Who this is for
- `goals`: 2-4 learning objectives or goals
- `keywords`: 5-10 main keywords
- `references`: Extract URLs, categorize as web/code/document/video
- `author`: If identifiable from content
- `faq`: 2-4 likely questions with answers

**`beats[].text`** (narration):
- If the beat's `text` is empty, generate a concise narration based on the slide content and extracted text
- The narration should be natural spoken language, NOT a verbatim copy of source text
- Match the language specified in `lang` field of the MulmoScript
- If the beat already has `text`, preserve it as-is

**`beats[].meta`** (per-beat):
- `section`: Logical section name (lowercase-kebab-case, e.g., "introduction", "main-topic-1", "conclusion")
- `tags`: Content type tags from: `intro`, `overview`, `definition`, `example`, `code`, `diagram`, `data`, `table`, `demo`, `comparison`, `summary`, `conclusion`, `q-and-a`
- `keywords`: 2-5 beat-specific terms
- `notes`: If `extracted_texts.json` exists, put the raw extracted text here
- `context`: Background info for AI query/summarize. Be substantive — don't just restate the slide
- `expectedQuestions`: 1-3 natural audience questions

### Step 5: Build and Write ExtendedScript

1. Start with the original MulmoScript (preserve ALL existing fields)
2. Add `scriptMeta` at the top level
3. Add `meta` to each beat, set `text` for narration
4. Add `outputProfiles: {}` (empty)
5. If beats don't have `id` fields, add them (`"beat-1"`, `"beat-2"`, ...)
6. Write to `scripts/{basename}/extended_script.json` with 2-space indentation

### Step 6: Validate

Run validation:
```bash
{cli} extend validate scripts/{basename}/extended_script.json
```

If validation fails, fix the errors and re-write the file. Repeat until validation passes.

### Step 7: Present Results and Next Steps

Display a summary:
- Number of beats processed
- Sections identified
- Key topics/keywords
- Output file path

Then show the user the next steps they can take:

```
ExtendedScript is ready! Here's what you can do next:

## Query the content interactively
npx mulmocast-preprocessor query scripts/{basename}/extended_script.json -i

## Generate a summary
npx mulmocast-preprocessor summarize scripts/{basename}/extended_script.json

## Generate a narrated video
npx mulmocast-preprocessor scripts/{basename}/extended_script.json -o scripts/{basename}/{basename}.json
npx mulmo movie scripts/{basename}/{basename}.json
```

Ask the user if they want to adjust any narration or metadata before proceeding.

## Quality Guidelines

- **Narration**: Write as if presenting to an audience. Use clear, spoken language. Avoid reading raw data verbatim — summarize and explain instead.
- **context field**: Most important for AI features. Add supplementary info: related concepts, technical background, real-world examples, historical context.
- **section naming**: Use lowercase-kebab-case. Consecutive beats in the same logical section share the same section value.
- **tags**: 2-4 tags per beat. Be specific but not excessive.
- **expectedQuestions**: Natural questions a real audience member would ask.
- **keywords**: Prefer specific technical terms over generic words.
- **Preserve original content**: Never modify existing MulmoScript fields (image, speaker, etc.) except `text` when generating narration.

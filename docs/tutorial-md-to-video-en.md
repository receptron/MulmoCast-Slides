# Tutorial: Markdown to Narrated Video

This tutorial walks you through converting a Markdown document (e.g., technical docs, blog posts, specifications) into a narrated video with AI-designed structure and speech. You'll also learn how to interactively query the content.

## Prerequisites

- Node.js 20+
- [Claude Code](https://claude.com/claude-code) (for the `/md-to-mulmo` skill)
- OpenAI API key (`OPENAI_API_KEY` environment variable)

```bash
# Install MulmoCast-Slides
npm install -g @mulmocast/slide

# Verify installation
mulmo-slide --help
```

## Setup

### 1. Create a project directory

```bash
mkdir my-md-project
cd my-md-project
```

### 2. Configure API keys

Create a `.env` file with your API key:

```bash
cat <<'EOF' > .env
OPENAI_API_KEY=sk-your-openai-api-key
EOF
```

- `OPENAI_API_KEY`: Used for text-to-speech (TTS) and video generation

### 3. Place your Markdown file

Copy the Markdown you want to convert into the project directory:

```bash
cp /path/to/your-document.md .
```

### 4. Install Claude Code skills

```bash
mulmo-slide extend init
```

This copies the skill files to `.claude/skills/` in your project.

## Quick Start (Copy-Paste)

```bash
# In Claude Code, run:
/md-to-mulmo your-document.md
```

That's it! The `/md-to-mulmo` skill automatically:
1. Parses the Markdown structure (`parse-md`)
2. Extracts sections, headings, code blocks, etc.
3. Uses an LLM to design a presentation plan
4. Assembles the ExtendedMulmoScript (`assemble-extended`)
5. Generates `detailed` (full) and `short` (summary) output profiles

## What `/md-to-mulmo` Produces

```
scripts/your-document/
  parsed_structure.json           # Parsed Markdown structure
  extended-script.schema.json     # ExtendedMulmoScript schema
  presentation-plan.schema.json   # Presentation plan schema
  presentation_plan.json          # LLM-designed presentation plan
  extended_script.json            # ExtendedMulmoScript (narration + metadata)
```

## After `/md-to-mulmo`: Next Steps

### Query the Content Interactively

Ask questions about your document:

```bash
npx mulmocast-preprocessor query scripts/your-document/extended_script.json -i
```

Example session:
```
> What is the main topic of this document?
The document explains microservice architecture design patterns...

> What deployment strategies are recommended?
1. Blue-Green Deployment
2. Canary Release
3. Rolling Update

> exit
```

Ask a single question:
```bash
npx mulmocast-preprocessor query scripts/your-document/extended_script.json "What are the key points?"
```

Generate a summary:
```bash
npx mulmocast-preprocessor summarize scripts/your-document/extended_script.json
```

### Generate a Narrated Video

Convert the ExtendedMulmoScript to a clean MulmoScript, then generate the video:

```bash
npx mulmocast-preprocessor scripts/your-document/extended_script.json \
  -o scripts/your-document/your-document.json
npx mulmo movie scripts/your-document/your-document.json
```

Output: `output/your-document_ja.mp4`

### Output Profiles

The ExtendedMulmoScript includes two output profiles:

- **`detailed`**: Full version with all beats
- **`short`**: Summary version with core beats only

Use the preprocessor's `-p` option to switch profiles:

```bash
# Generate with the short profile
npx mulmocast-preprocessor scripts/your-document/extended_script.json \
  -o scripts/your-document/your-document.json -p short
```

### Review and Iterate

Watch the video and check the narration quality. If you want to adjust:

1. Edit `scripts/your-document/extended_script.json` directly (modify `text` fields)
2. Or re-run `/md-to-mulmo` with instructions for adjustments
3. Re-run the video generation commands above

## Pipeline Details (Manual Execution)

You can also run each step of `/md-to-mulmo` individually:

### Step 1: Parse Markdown

```bash
mulmo-slide parse-md your-document.md
```

Parses the Markdown structure (headings, paragraphs, code blocks, lists, etc.) and generates JSON and JSON Schema files.

### Step 2: Create Presentation Plan (LLM)

```bash
# In Claude Code, run:
/md-to-mulmo your-document.md
```

The LLM designs a presentation plan (`presentation_plan.json`) based on `parsed_structure.json`.

### Step 3: Assemble ExtendedMulmoScript

```bash
mulmo-slide assemble-extended scripts/your-document/presentation_plan.json
```

Generates the ExtendedMulmoScript from the presentation plan.

### Step 4: Convert to MulmoScript

```bash
npx mulmocast-preprocessor scripts/your-document/extended_script.json \
  -o scripts/your-document/your-document.json
```

### Step 5: Generate Video

```bash
npx mulmo movie scripts/your-document/your-document.json
```

Output: `output/your-document_ja.mp4`

## Alternative Workflow: `/narrate`

If you already have a slide-format presentation (PDF, PPTX, Keynote), you can use the `/narrate` skill instead. See the [PDF to Narrated Video tutorial](./tutorial-pdf-to-video-en.md) for details.

## Troubleshooting

### `mulmo-slide extend init` not run

If the `/md-to-mulmo` skill is not found, run `mulmo-slide extend init` to install the skills.

### File not found with `parse-md`

Verify the Markdown file path is correct. Both relative and absolute paths are accepted.

### Validation error with `assemble-extended`

Ensure `presentation_plan.json` conforms to `presentation-plan.schema.json`. If the LLM-generated plan has an invalid format, re-run `/md-to-mulmo`.

### "Unrecognized key: scriptMeta" error when running `mulmo movie`

The preprocessor may not fully strip extended fields. Run this to clean up:

```bash
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('scripts/your-document/your-document.json', 'utf8'));
delete d.scriptMeta;
delete d.outputProfiles;
d.beats.forEach(b => { delete b.meta; delete b.variants; });
fs.writeFileSync('scripts/your-document/your-document.json', JSON.stringify(d, null, 2));
"
```

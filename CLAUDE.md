@AGENTS.md

## Markdown to PDF Conversion

### Step 1: Markdown → MulmoScript

```bash
yarn cli markdown samples/simple_text.md
yarn cli markdown samples/code_samples.md
yarn cli markdown samples/mermaid_diagrams.md --mermaid
yarn cli markdown samples/tables_data.md
```

Output: `scripts/{basename}/mulmo_script.json`

### Step 2: MulmoScript → PDF

```bash
npx mulmo pdf scripts/simple_text/mulmo_script.json
npx mulmo pdf scripts/code_samples/mulmo_script.json
npx mulmo pdf scripts/mermaid_diagrams/mulmo_script.json
npx mulmo pdf scripts/tables_data/mulmo_script.json
```

Output: `output/mulmo_script_slide_ja.pdf`

### Options

- `--mermaid`: Enable mermaid diagram support with row-2 layout
- `--directive`: Remove Marp-style directives
- `-s heading`: Use heading as slide separator
- `--style corporate-blue`: Apply style to markdown slides

## Source File to Narrated ExtendedScript

### Option A: CLI (automated, requires OPENAI_API_KEY)

```bash
yarn cli narrate samples/your-paper.pdf -l ja
yarn cli narrate samples/your-slides.md --mermaid
```

This runs the full pipeline automatically: convert → scaffold → LLM narration/metadata → validate.

### Option B: `/narrate` skill (interactive, higher quality)

```
/narrate samples/your-paper.pdf
```

Uses `--scaffold-only` for conversion, then Claude Code analyzes and generates metadata interactively.

Output: `scripts/{basename}/extended_script.json`

## MulmoScript to ExtendedScript (low-level)

Use the `/extend` skill to add metadata to an existing MulmoScript.

```
/extend scripts/simple_text/mulmo_script.json
```

## ExtendedScript to Movie

1. Process ExtendedScript back to MulmoScript using the preprocessor:
   ```bash
   npx mulmocast-preprocessor scripts/{basename}/extended_script.json -o scripts/{basename}/mulmo_script.json
   ```
2. Generate movie:
   ```bash
   npx mulmo movie scripts/{basename}/mulmo_script.json
   ```
   Output: `output/mulmo_script_ja.mp4`

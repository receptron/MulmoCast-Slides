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

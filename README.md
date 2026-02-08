# MulmoCast-Slides

A collection of tools to convert presentation files into MulmoScript format, enabling automated narration and processing of slide decks.

## Overview

MulmoCast-Slides provides converters that extract slides and speaker notes from various presentation formats (Keynote, PowerPoint, PDF, etc.) and generate MulmoScript JSON files. Each slide is exported as an image paired with its speaker notes.

## System Requirements

### Node.js

- Node.js 22 or later
- yarn or npm

### macOS

```bash
# Required for PDF and PPTX conversion
brew install imagemagick ghostscript

# Required for PPTX conversion (converts PPTX to PDF)
brew install --cask libreoffice

# Required for Keynote conversion
# Keynote app must be installed from App Store
```

### Linux (Ubuntu/Debian)

```bash
# Required for PDF and PPTX conversion
sudo apt-get update
sudo apt-get install -y imagemagick ghostscript

# Required for PPTX conversion
sudo apt-get install -y libreoffice
```

### Environment Variables

```bash
# Required for LLM narration generation (-g option)
export OPENAI_API_KEY=your-openai-api-key

# Optional: Set default language (en, ja, fr, de)
export MULMO_LANG=ja
```

### Feature Requirements Summary

| Feature | macOS | Linux | Required Tools |
|---------|-------|-------|----------------|
| Marp (.md) | Yes | Yes | Node.js only |
| PPTX (.pptx) | Yes | Yes | LibreOffice, ImageMagick, Ghostscript |
| PDF (.pdf) | Yes | Yes | ImageMagick, Ghostscript |
| Keynote (.key) | Yes | No | Keynote app, Python 3 |
| LLM Narration (-g) | Yes | Yes | OPENAI_API_KEY |

## Installation

### npm (Global Installation)

```bash
npm install -g @mulmocast/slide
```

After installation, use the `mulmo-slide` command:

```bash
mulmo-slide marp presentation.md
mulmo-slide pptx presentation.pptx
mulmo-slide pdf presentation.pdf
mulmo-slide movie presentation.pptx
```

### npx (No Installation)

```bash
npx @mulmocast/slide marp presentation.md
npx @mulmocast/slide pptx presentation.pptx -g -l ja
```

### Development Setup

```bash
git clone https://github.com/receptron/MulmoCast-Slides.git
cd MulmoCast-Slides
yarn install
yarn build  # Build TypeScript to lib/
```

### Running Sample Files

The `samples/` directory contains example files for testing:

```bash
# Marp markdown
yarn marp samples/sample.md
yarn marp samples/custom_theme_demo.md --theme samples/custom-ocean.css

# PowerPoint
yarn pptx samples/omochikaeri.pptx
yarn pptx samples/omochikaeri.pptx -g -l ja  # with LLM narration

# PDF
yarn pdf samples/20251008_2.pdf
yarn pdf samples/20251008_2.pdf -g -l ja  # with LLM narration

# Keynote (macOS only)
yarn keynote samples/GraphAI.key

# Generate movie from sample
yarn movie samples/omochikaeri.pptx -g -l ja

# Generate bundle from sample
yarn bundle samples/sample.md -g -l ja
```

**Note:** When re-running commands, the existing `mulmo_script.json` will be reused. To regenerate:
- Delete the existing JSON file: `rm scripts/<basename>/mulmo_script.json`
- Or use the `-f` (force) flag with movie/bundle: `yarn movie samples/sample.pptx -f -g`

## Unified CLI

All commands are available through the unified `mulmo-slide` CLI:

```bash
mulmo-slide <command> [options]

Commands:
  mulmo-slide convert <file>     Convert any presentation (auto-detect format)
  mulmo-slide marp <file>        Convert Marp markdown to MulmoScript
  mulmo-slide pptx <file>        Convert PowerPoint to MulmoScript
  mulmo-slide pdf <file>         Convert PDF to MulmoScript
  mulmo-slide keynote <file>     Convert Keynote to MulmoScript (macOS only)
  mulmo-slide movie <file>       Generate movie from presentation
  mulmo-slide bundle <file>      Generate MulmoViewer bundle from presentation
  mulmo-slide narrate <file>     Generate narrated ExtendedScript (full pipeline)
  mulmo-slide extend init        Install Claude Code skills (/narrate, /extend)
  mulmo-slide extend validate    Validate ExtendedScript JSON against schema
  mulmo-slide extend scaffold    Create ExtendedScript skeleton from MulmoScript
```

The `convert` command auto-detects file format by extension (.pptx, .md, .key, .pdf).

For development, you can also use yarn commands:

```bash
yarn cli marp presentation.md
yarn marp presentation.md      # shorthand
```

## MulmoScript Format

MulmoScript is a JSON-based format that combines images with text for multimedia presentations. It supports multiple image formats:

### PNG Image Format

```json
{
  "$mulmocast": {
    "version": "1.1",
    "credit": "closing"
  },
  "beats": [
    {
      "text": "Speaker notes or narration text",
      "image": {
        "type": "image",
        "source": {
          "kind": "path",
          "path": "/absolute/path/to/slide.png"
        }
      }
    }
  ]
}
```

### Markdown Format

```json
{
  "$mulmocast": {
    "version": "1.1",
    "credit": "closing"
  },
  "beats": [
    {
      "text": "Speaker notes or narration text",
      "image": {
        "type": "markdown",
        "markdown": [
          "# Slide Title",
          "- Bullet point 1",
          "- Bullet point 2"
        ]
      }
    }
  ]
}
```

## Available Tools

### Keynote Extractor

Extracts slides and speaker notes from Apple Keynote presentations.

**Usage:**

```bash
# CLI
mulmo-slide keynote path/to/presentation.key

# yarn (development)
yarn keynote path/to/presentation.key

# Test with sample
yarn test:keynote
```

**Requirements:**
- macOS
- Keynote installed
- Python 3

**Output:**
- `scripts/<basename>/images/` - PNG images of each slide
- `scripts/<basename>/mulmo_script.json` - MulmoScript JSON file

### Marp Extractor

Extracts slides and speaker notes from Marp markdown presentations, generating both PNG and Markdown formats.

**Usage:**

```bash
# CLI
mulmo-slide marp path/to/presentation.md
mulmo-slide marp path/to/presentation.md -g -l en  # with LLM narration

# yarn (development)
yarn marp path/to/presentation.md
yarn marp path/to/presentation.md -g -l en

# Test with sample
yarn test:marp
```

**Options:**
- `-l, --lang` - Language for the MulmoScript (en, ja, fr, de)
- `-g, --generate-text` - Generate narration text using OpenAI LLM
- `--theme` - Path to custom theme CSS file
- `--allow-local-files` - Allow local file access in Marp

**Requirements:**
- Node.js
- @marp-team/marp-cli
- Puppeteer (installed automatically)
- OpenAI API key (for `-g` option)

**Output:**
- `scripts/<basename>/images/` - PNG images of each slide
- `scripts/<basename>/mulmo_script.json` - MulmoScript JSON file (PNG format)
- `scripts/<basename>/mulmo_script-markdown.json` - MulmoScript JSON file (Markdown format)

**Features:**
- Extracts speaker notes from HTML comments (`<!-- note text -->`)
- Generates both PNG images and structured Markdown output
- Preserves slide formatting and structure

### Markdown Converter

Converts plain Markdown files to MulmoScript format with flexible separator options and plugin support.

**Usage:**

```bash
# CLI
mulmo-slide markdown path/to/document.md
mulmo-slide markdown path/to/document.md -g -l ja  # with LLM narration
mulmo-slide markdown path/to/document.md -s heading-2  # split by ## headings
mulmo-slide markdown path/to/document.md --mermaid --directive  # with plugins

# yarn (development)
yarn markdown path/to/document.md
yarn markdown path/to/document.md -s heading --mermaid --style corporate-blue
```

**Options:**
- `-l, --lang` - Language for the MulmoScript (en, ja, fr, de)
- `-g, --generate-text` - Generate narration text using LLM
- `-s, --separator` - Slide separator mode (see below)
- `--mermaid` - Convert mermaid code blocks to mermaid beat type
- `--directive` - Remove Marp-style directives
- `--layout` - Auto-detect layout based on content (see below)
- `--style` - Markdown slide style (e.g., corporate-blue, finance-green)

**Separator Modes:**

| Mode | Description | Example |
|------|-------------|---------|
| `horizontal-rule` | Split by `---` (default) | Marp, reveal.js style |
| `heading` | Split by any heading | `#`, `##`, `###` |
| `heading-1` | Split by `#` only | Top-level sections |
| `heading-2` | Split by `##` only | Second-level sections |
| `heading-3` | Split by `###` only | Third-level sections |
| `blank-lines` | Split by 3+ blank lines | Simple documents |
| `comment` | Split by `<!-- slide -->` | HTML-compatible |
| `page-break` | Split by `<!-- pagebreak -->` | Print-style documents |

**Layout Auto-Detection (`--layout`):**

When enabled, the converter automatically detects the best layout based on content.

Detection rules are evaluated in order (first match wins):

**Phase 1: Header Detection (H1)**

If markdown contains an H1 heading (`# Title`), it becomes the header and remaining content is analyzed:

```
┌─────────────────────────────────────┬─────────────────┬─────────────────────────────────┐
│ Content Pattern                     │ Layout          │ Conditions                      │
├─────────────────────────────────────┼─────────────────┼─────────────────────────────────┤
│ H1 only                             │ (no layout)     │ Only H1, no other content       │
│                                     │                 │ → default markdown (array)      │
├─────────────────────────────────────┼─────────────────┼─────────────────────────────────┤
│ H1 + unstructured content           │ header+content  │ H1 + text without H2/H3         │
│                                     │                 │ → { header, content: [...] }    │
├─────────────────────────────────────┼─────────────────┼─────────────────────────────────┤
│ H1 + structured content             │ header+row-2    │ H1 + content matching row-2/2x2 │
│                                     │ header+2x2      │ → { header, "row-2": [...] }    │
└─────────────────────────────────────┴─────────────────┴─────────────────────────────────┘
```

**Phase 2: Content Layout Rules (no H1, or applied to content after H1)**

```
┌─────────────────────────────────────┬────────────┬─────────────────────────────────────┐
│ Content Pattern                     │ Layout     │ Conditions                          │
├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
│ 1. Single code block + text         │ row-2      │ Exactly 1 code block (```)          │
│                                     │            │ Text content > 20 chars             │
│                                     │            │ → [text, code]                      │
├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
│ 2. Single image + text              │ row-2      │ Exactly 1 image (![]())             │
│                                     │            │ Text content > 20 chars             │
│                                     │            │ → [text, image]                     │
├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
│ 3. 4+ H3 sections (short)           │ 2x2        │ 4 or more ### headings              │
│                                     │            │ Avg content < 200 chars             │
│                                     │            │ → first 4 sections                  │
├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
│ 4. 4+ H2 sections (short)           │ 2x2        │ 4 or more ## headings               │
│                                     │            │ Avg content < 200 chars             │
│                                     │            │ → first 4 sections                  │
├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
│ 5. 4+ H2 sections (long)            │ row-2      │ 4 or more ## headings               │
│                                     │            │ Avg content >= 200 chars            │
│                                     │            │ → first 2 sections                  │
├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
│ 6. 2+ H2 sections                   │ row-2      │ 2 or more ## headings               │
│                                     │            │ → first 2 sections                  │
├─────────────────────────────────────┼────────────┼─────────────────────────────────────┤
│ 7. Otherwise                        │ default    │ No layout applied                   │
└─────────────────────────────────────┴────────────┴─────────────────────────────────────┘
```

**Notes:**
- "Meaningful text" = text without headings > 20 characters
- Multiple code blocks or images → no layout detected
- H3 has no fallback (only 2x2 if short, otherwise no layout)
- H1 always becomes header; remaining content is analyzed for structure

Example:
```bash
# Auto-detect layout for better visual presentation
mulmo-slide markdown document.md --layout --style corporate-blue
```

**Output:**
- `scripts/<basename>/mulmo_script.json` - MulmoScript JSON file (Markdown format)

### PowerPoint (PPTX) Converter

Converts PowerPoint presentations to MulmoScript format with high-quality PNG exports.

**Usage:**

```bash
# CLI
mulmo-slide pptx path/to/presentation.pptx
mulmo-slide pptx path/to/presentation.pptx -g -l ja  # with LLM narration

# yarn (development)
yarn pptx path/to/presentation.pptx
yarn pptx path/to/presentation.pptx -g -l ja
```

**Options:**
- `-l, --lang` - Language for the MulmoScript (en, ja, fr, de)
- `-g, --generate-text` - Generate narration text using OpenAI LLM

**Requirements:**
- Node.js
- LibreOffice (used for PPTX to PDF conversion)
- ImageMagick (for high-quality PNG export with antialiasing)
- OpenAI API key (for `-g` option)

**Output:**
- `scripts/<basename>/` - Directory named after input file
- `scripts/<basename>/images/<basename>-0.png, -1.png, ...` - PNG images of each slide
- `scripts/<basename>/mulmo_script.json` - MulmoScript JSON file

### PDF Converter

Converts PDF files to MulmoScript format with high-quality PNG exports.

**Usage:**

```bash
# CLI
mulmo-slide pdf path/to/presentation.pdf
mulmo-slide pdf path/to/presentation.pdf -g -l ja  # with LLM narration

# yarn (development)
yarn pdf path/to/presentation.pdf
yarn pdf path/to/presentation.pdf -g -l ja
```

**Options:**
- `-l, --lang` - Language for the MulmoScript (en, ja, fr, de)
- `-g, --generate-text` - Generate narration text using OpenAI LLM

**Requirements:**
- Node.js
- ImageMagick (for high-quality PNG export with antialiasing)
- OpenAI API key (for `-g` option)

**Output:**
- `scripts/<basename>/` - Directory named after input file
- `scripts/<basename>/images/<basename>-0.png, -1.png, ...` - PNG images of each page
- `scripts/<basename>/mulmo_script.json` - MulmoScript JSON file

## Movie Generation

Generate a movie directly from any supported presentation format.

**Usage:**

```bash
# CLI
mulmo-slide movie path/to/presentation.pptx
mulmo-slide movie path/to/presentation.pdf
mulmo-slide movie path/to/presentation.md
mulmo-slide movie path/to/presentation.key  # macOS only
mulmo-slide movie path/to/presentation.pptx -f -g -l ja  # force regenerate with LLM in Japanese

# yarn (development)
yarn movie path/to/presentation.pptx
yarn movie path/to/presentation.pptx -f -g -l ja
```

**Options:**
- `-l, --lang` - Language for the MulmoScript (en, ja, fr, de)
- `-f, --force` - Force regenerate MulmoScript (default: use existing if available)
- `-g, --generate-text` - Generate narration text using OpenAI LLM (only when generating)

This command:
1. Converts the presentation to MulmoScript format (or uses existing)
2. Generates audio and images using mulmocast
3. Creates the final movie

**Output:**
- `output/<basename>/` - Movie and related files

## Bundle Generation

Generate a MulmoViewer bundle directly from any supported presentation format.

**Usage:**

```bash
# CLI
mulmo-slide bundle path/to/presentation.pptx
mulmo-slide bundle path/to/presentation.pdf
mulmo-slide bundle path/to/presentation.md
mulmo-slide bundle path/to/presentation.key  # macOS only
mulmo-slide bundle path/to/presentation.pptx -f -g -l ja  # force regenerate with LLM in Japanese

# yarn (development)
yarn bundle path/to/presentation.pptx
yarn bundle path/to/presentation.pptx -f -g -l ja
```

**Options:**
- `-l, --lang` - Language for the MulmoScript (en, ja, fr, de)
- `-f, --force` - Force regenerate MulmoScript (default: use existing if available)
- `-g, --generate-text` - Generate narration text using OpenAI LLM (only when generating)

This command:
1. Converts the presentation to MulmoScript format (or uses existing)
2. Translates content to multiple languages (ja, en)
3. Generates audio and images
4. Creates a bundle for MulmoViewer (skipZip mode)

**Output:**
- `output/<basename>/` - Bundle files for MulmoViewer

## Language Setting

All converters support setting the language for the generated MulmoScript.

**Supported languages:** `en` (English), `ja` (Japanese), `fr` (French), `de` (German)

**Priority:** CLI option > Environment variable > Default (`en`)

**CLI option:**
```bash
mulmo-slide pptx presentation.pptx -l ja
mulmo-slide marp presentation.md --lang fr
mulmo-slide keynote presentation.key -l de
```

**Environment variable:**
```bash
export MULMO_LANG=ja
yarn pptx presentation.pptx
```

## LLM Text Generation

Generate narration text for each slide using OpenAI's GPT-4o model.

**Usage:**
```bash
# PPTX: Uses slide images with Vision API
mulmo-slide pptx presentation.pptx -g -l ja

# PDF: Uses page images with Vision API
mulmo-slide pdf presentation.pdf -g -l ja

# Marp: Uses markdown content
mulmo-slide marp presentation.md -g -l en

# Bundle/Movie: Use with -f to regenerate
mulmo-slide bundle presentation.pptx -f -g
```

**Requirements:**
- `OPENAI_API_KEY` environment variable must be set

**How it works:**
- For PPTX/PDF: Converts slides/pages to images and uses OpenAI Vision API to understand content
- For Marp: Uses the markdown content directly
- The LLM considers the overall presentation structure to generate contextual narration
- Output is in the specified language (`-l` option)

## Narrate CLI

Generate a narrated ExtendedScript from any supported source file in one command. This automates the full pipeline: conversion to MulmoScript, LLM-based narration and metadata generation, and validation.

**Usage:**

```bash
# Full pipeline (requires OPENAI_API_KEY)
mulmo-slide narrate paper.pdf
mulmo-slide narrate slides.pptx -l ja
mulmo-slide narrate document.md --mermaid -s heading

# Scaffold only (no LLM, for Claude Code handoff)
mulmo-slide narrate paper.pdf --scaffold-only

# yarn (development)
yarn narrate samples/sample.pdf -l ja
yarn narrate samples/sample.pdf --scaffold-only
```

**Options:**
- `-l, --lang` - Language for narration (en, ja, fr, de)
- `--scaffold-only` - Only create ExtendedScript skeleton (no LLM). Useful as preparation for Claude Code `/narrate` analysis
- `-f, --force` - Force regenerate MulmoScript even if it exists
- `-s, --separator` - Slide separator mode (for Markdown files)
- `--mermaid` - Convert mermaid code blocks (for Markdown files)

**Output:** `scripts/{basename}/extended_script.json`

### Extend Scaffold

Create an ExtendedScript skeleton from an existing MulmoScript without any LLM calls. This adds beat IDs, empty metadata fields, and imports extracted texts as notes.

```bash
mulmo-slide extend scaffold scripts/basename/mulmo_script.json

# yarn (development)
yarn cli extend scaffold scripts/basename/mulmo_script.json
```

## Narrate: Source File to Narrated Video (Claude Code Skill)

The `/narrate` skill converts any supported source file into a narrated ExtendedScript in one step. It handles the full pipeline: conversion, narration generation, metadata, and validation.

### Setup

Install the Claude Code skills into your project:

```bash
# If installed globally
mulmo-slide extend init

# With npx
npx @mulmocast/slide extend init

# Development
yarn cli extend init
```

This copies the skill files to `.claude/skills/` in your project directory.

### Usage

In Claude Code, use the `/narrate` command with any supported source file:

```
/narrate your-paper.pdf
/narrate your-slides.pptx
/narrate your-slides.md
/narrate your-slides.key
```

The skill automatically:
1. Converts the source file to MulmoScript (slide images + text extraction)
2. Generates AI narration for each slide
3. Adds metadata (keywords, sections, context, FAQ)
4. Validates the output
5. Shows you the next steps

**Output:** `scripts/{basename}/extended_script.json`

### After `/narrate`: Next Steps

```bash
# Query the content interactively
npx mulmocast-preprocessor query scripts/{basename}/extended_script.json -i

# Generate a summary
npx mulmocast-preprocessor summarize scripts/{basename}/extended_script.json

# Generate a narrated video
npx mulmocast-preprocessor scripts/{basename}/extended_script.json -o scripts/{basename}/mulmo_script.json
npx mulmo movie scripts/{basename}/mulmo_script.json
```

### Validating ExtendedScript

Validate an ExtendedScript JSON file against the schema:

```bash
mulmo-slide extend validate scripts/simple_text/extended_script.json

# Development
yarn cli extend validate scripts/simple_text/extended_script.json
```

Outputs beat count, scriptMeta presence, meta coverage percentage, and sections found.

### Low-level: `/extend`

If you already have a MulmoScript and just want to add metadata:

```
/extend scripts/simple_text/mulmo_script.json
```

### Tutorials

- [English: PDF to Narrated Video](docs/tutorial-pdf-to-video-en.md)
- [Japanese: PDF からナレーション付き動画](docs/tutorial-pdf-to-video-ja.md)

## Output Structure

All tools generate MulmoScript output in `scripts/<basename>/` with a unified structure:

```
scripts/<basename>/
├── images/
│   ├── <basename>-0.png (or images.001.png for Marp)
│   ├── <basename>-1.png (or images.002.png for Marp)
│   └── ...
├── mulmo_script.json            # MulmoScript (all formats)
└── mulmo_script-markdown.json   # Marp only: Markdown format
```

## License

MIT

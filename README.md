[![npm version](https://badge.fury.io/js/%40mulmocast%2Fslide.svg)](https://badge.fury.io/js/%40mulmocast%2Fslide)
# MulmoCast-Slides

Convert presentations (PPTX, PDF, Markdown, Keynote) and videos into **narrated movies** or **interactive web viewer bundles**.

| Input | Output | Command |
|-------|--------|---------|
| PPTX / PDF / Markdown / Keynote | Narrated video (.mp4) | `mulmo-slide movie <file> -g -l ja` |
| PPTX / PDF / Markdown / Keynote | Web viewer bundle | `mulmo-slide bundle <file> -g -l ja` |
| Video (.mp4, .webm, etc.) | Transcribed & translated bundle | `mulmo-slide transcribe <file>` |
| Web article URL | MulmoScript with narration | `mulmo-slide url <url> -e author -l ja` |

```bash
# Generate a narrated video from slides
mulmo-slide movie presentation.pptx -g -l ja

# Generate a web viewer bundle and preview in browser
mulmo-slide bundle presentation.pptx -g -l ja
mulmo-slide preview
```

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
| URL (web article) | Yes | Yes | Puppeteer (bundled), OPENAI_API_KEY |
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

**Note:** When re-running commands, the existing MulmoScript JSON will be reused. To regenerate:
- Delete the existing JSON file: `rm scripts/<basename>/<basename>.json`
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
  mulmo-slide transcribe <file>  Transcribe video to MulmoScript with translations and TTS
  mulmo-slide url <url>          Generate MulmoScript from a web article URL
  mulmo-slide movie <file>       Generate movie from presentation
  mulmo-slide bundle <file>      Generate MulmoViewer bundle from presentation
  mulmo-slide narrate <file>     Generate narrated ExtendedMulmoScript (full pipeline)
  mulmo-slide extend init        Install Claude Code skills (/narrate, /extend)
  mulmo-slide extend validate    Validate ExtendedMulmoScript JSON against schema
  mulmo-slide extend scaffold    Create ExtendedMulmoScript skeleton from MulmoScript
  mulmo-slide parse-md <file>    Parse markdown structure for LLM presentation planning
  mulmo-slide assemble-extended <file>  Assemble ExtendedMulmoScript from presentation plan
```

The `convert` command auto-detects file format by extension (.pptx, .md, .key, .pdf, .mp4, .mov, .mkv, .webm, .avi).

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
- `scripts/<basename>/<basename>.json` - MulmoScript JSON file

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
- `scripts/<basename>/<basename>.json` - MulmoScript JSON file (PNG format)
- `scripts/<basename>/<basename>-markdown.json` - MulmoScript JSON file (Markdown format)

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
- `scripts/<basename>/<basename>.json` - MulmoScript JSON file (Markdown format)

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
- `scripts/<basename>/<basename>.json` - MulmoScript JSON file

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
- `scripts/<basename>/<basename>.json` - MulmoScript JSON file

## URL to MulmoScript

Generate a MulmoScript presentation from any web article URL. The tool fetches the article content using Puppeteer, checks content quality, and uses LLM to generate narrated presentation beats.

**Usage:**

```bash
# Basic usage (author perspective, English)
mulmo-slide url https://example.com/article

# With expression style and language
mulmo-slide url https://example.com/article -e author -l ja
mulmo-slide url https://example.com/article -e news -l en
mulmo-slide url https://example.com/article -e overview -l ja

# With beat count target
mulmo-slide url https://example.com/article -b 10

# Generate movie or bundle after MulmoScript
mulmo-slide url https://example.com/article -e author --movie -l ja
mulmo-slide url https://example.com/article -e news --bundle

# yarn (development)
yarn url https://example.com/article -e author -l ja
```

**Options:**
- `-e, --expression` - Expression style: `author` (default), `news`, `overview`
- `-l, --lang` - Language for narration (en, ja, fr, de)
- `-b, --beats` - Target beat count (approximate)
- `--style` - Markdown visual style (e.g., corporate-blue)
- `-f, --force` - Force regenerate MulmoScript
- `--movie` - Also generate movie
- `--bundle` - Also generate bundle

**Expression Styles:**

| Style | Description |
|-------|-------------|
| `author` | First-person perspective from the article author's viewpoint |
| `news` | Objective news anchor presentation |
| `overview` | Concise summary of key points |

**Requirements:**
- Node.js
- Puppeteer (bundled via mulmocast dependency)
- `OPENAI_API_KEY` environment variable

**Output:**
- `scripts/<YYYYMMDD-title>/article.txt` - Fetched article text with URL and title
- `scripts/<YYYYMMDD-title>/<YYYYMMDD-title>.json` - MulmoScript JSON file

**Pipeline:**
1. Fetches article content using Puppeteer + Readability
2. Checks content quality (rejects login pages, 404s, empty pages)
3. Generates presentation beats using LLM with selected expression style
4. Validates output against MulmoScript schema (retries up to 3 times)
5. Optionally generates movie or bundle

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

## Previewing Bundles (Web Viewer)

Preview generated bundles in the browser using the built-in Vue 3 web viewer.

```bash
# Production preview (npm global install)
mulmo-slide preview
mulmo-slide preview 8080   # custom port

# Development mode (hot reload)
yarn dev
```

Opens http://localhost:3000 and automatically discovers bundles from the `output/` directory.

**Features:**
- Slide display with narration playback
- Audio / text language switching (multilingual support)
- Recording mode: record via microphone → Whisper transcription → edit text → save
- AI Q&A chat: ask questions about the presentation content (GPT-4o-mini, requires `VITE_OPENAI_API_KEY` in `.env`)

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

Generate a narrated ExtendedMulmoScript from any supported source file in one command. This automates the full pipeline: conversion to MulmoScript, LLM-based narration and metadata generation, and validation.

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
- `--scaffold-only` - Only create ExtendedMulmoScript skeleton (no LLM). Useful as preparation for Claude Code `/narrate` analysis
- `-f, --force` - Force regenerate MulmoScript even if it exists
- `-s, --separator` - Slide separator mode (for Markdown files)
- `--mermaid` - Convert mermaid code blocks (for Markdown files)

**Output:** `scripts/{basename}/extended_script.json`

### Extend Scaffold

Create an ExtendedMulmoScript skeleton from an existing MulmoScript without any LLM calls. This adds beat IDs, empty metadata fields, and imports extracted texts as notes.

```bash
mulmo-slide extend scaffold scripts/<basename>/<basename>.json

# yarn (development)
yarn cli extend scaffold scripts/<basename>/<basename>.json
```

## Markdown to ExtendedMulmoScript (LLM-assisted)

Convert a structured markdown document into an ExtendedMulmoScript with intelligent beat allocation, narration, and metadata. This is a multi-step process using the `/md-to-mulmo` Claude Code skill.

### Pipeline Overview

1. **Parse** (`parse-md`): Extract document structure and generate JSON Schemas
2. **Plan** (LLM via `/md-to-mulmo` skill): Create presentation plan with beat allocation
3. **Assemble** (`assemble-extended`): Convert plan to ExtendedMulmoScript with variants

### Usage

```bash
# Step 1: Parse markdown and generate schemas
mulmo-slide parse-md path/to/document.md

# Step 2: Use /md-to-mulmo skill in Claude Code (creates presentation_plan.json)

# Step 3: Assemble ExtendedMulmoScript from plan
mulmo-slide assemble-extended scripts/{basename}/presentation_plan.json

# Step 4: Generate MulmoScript from ExtendedMulmoScript
npx mulmocast-preprocessor scripts/{basename}/extended_script.json -o scripts/{basename}/{basename}.json
```

**Output of `parse-md`:**
- `scripts/{basename}/parsed_structure.json` — structured markdown sections
- `scripts/{basename}/extended-script.schema.json` — ExtendedMulmoScript JSON Schema
- `scripts/{basename}/presentation-plan.schema.json` — intermediate plan schema

**Output of `assemble-extended`:**
- `scripts/{basename}/extended_script.json` — validated ExtendedMulmoScript with output profiles

### Setup

Install the Claude Code skill:

```bash
mulmo-slide extend init
```

Then use `/md-to-mulmo path/to/document.md` in Claude Code.

## Narrate: Source File to Narrated Video (Claude Code Skill)

> **Tip:** If you don't need interactive analysis and want a fully automated pipeline, use the [Narrate CLI](#narrate-cli) instead (`mulmo-slide narrate <file>`). It runs the full pipeline with OpenAI GPT-4o without requiring Claude Code.

The `/narrate` skill converts any supported source file into a narrated ExtendedMulmoScript in one step. It handles the full pipeline: conversion, narration generation, metadata, and validation.

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
npx mulmocast-preprocessor scripts/{basename}/extended_script.json -o scripts/{basename}/{basename}.json
npx mulmo movie scripts/{basename}/{basename}.json
```

### Validating ExtendedMulmoScript

Validate an ExtendedMulmoScript JSON file against the schema:

```bash
mulmo-slide extend validate scripts/simple_text/extended_script.json

# Development
yarn cli extend validate scripts/simple_text/extended_script.json
```

Outputs beat count, scriptMeta presence, meta coverage percentage, and sections found.

### Low-level: `/extend`

If you already have a MulmoScript and just want to add metadata:

```
/extend scripts/simple_text/simple_text.json
```

### Tutorials

- [English: PDF to Narrated Video](docs/tutorial-pdf-to-video-en.md)
- [Japanese: PDF からナレーション付き動画](docs/tutorial-pdf-to-video-ja.md)

## Output Structure

This tool generates files in two directories: `scripts/` for intermediate data (MulmoScript, metadata) and `output/` for final deliverables (movies, bundles). The `<basename>` is derived from the input filename without extension (e.g., `presentation.pptx` → `presentation`).

### `scripts/<basename>/` — Intermediate Files

Generated by conversion commands (`convert`, `marp`, `pptx`, `pdf`, `keynote`, `markdown`, `transcribe`) and narration/metadata commands (`narrate`, `extend`, `parse-md`, `assemble-extended`).

#### Conversion Output

| File | Generated by | Description |
|------|-------------|-------------|
| `<basename>.json` | All converters | **MulmoScript** — the core JSON format pairing slides with narration text |
| `<basename>-markdown.json` | `marp` only | MulmoScript using Markdown content instead of PNG images |
| `images/` | `marp`, `pptx`, `pdf`, `keynote` | Slide images as PNG files |
| `images/<basename>-0.png`, `-1.png`, ... | `pptx`, `pdf`, `keynote` | One PNG per slide/page (zero-indexed) |
| `images/images.001.png`, `.002.png`, ... | `marp` | One PNG per slide (one-indexed, Marp naming convention) |
| `<basename>.pdf` | `pptx` | Intermediate PDF created by LibreOffice during PPTX→PNG conversion |
| `extracted_texts.json` | `pdf` | Array of raw text extracted from each PDF page (used by `/extend` and `narrate` for metadata) |

#### Video Transcription Output (`transcribe` / `convert` with video files)

The video transcription pipeline splits a video by silence detection, transcribes each segment with OpenAI Whisper, and optionally generates a multi-language bundle.

| File | Description |
|------|-------------|
| `<basename>.json` | MulmoScript with `type: "movie"` beats referencing video segments |
| `1.mp4`, `2.mp4`, ... | Split video segments (one per detected segment) |
| `1.mp3`, `2.mp3`, ... | Extracted audio from each video segment (used for Whisper transcription) |
| `1.jpg`, `2.jpg`, ... | Thumbnail images from each video segment (first frame) |

When bundle generation is enabled (default), additional files are created in `output/<basename>/<basename>/`:

| File | Description |
|------|-------------|
| `mulmo_view.json` | Viewer data with multi-language text and audio references |
| `1.mp4`, `2.mp4`, ... | Video segments (copied from scripts) |
| `1.mp3`, `2.mp3`, ... | Source language audio (copied from scripts) |
| `1.jpg`, `2.jpg`, ... | Thumbnails (copied from scripts) |
| `<N>_<lang>.mp3` | TTS audio for translated text (e.g., `1_ja.mp3`, `2_ja.mp3`) |

#### Narration & Metadata Output

| File | Generated by | Description |
|------|-------------|-------------|
| `extended_script.json` | `narrate`, `extend scaffold`, `assemble-extended` | **ExtendedMulmoScript** — MulmoScript enriched with `scriptMeta`, `beats[].meta`, output profiles, and variants |
| `analysis.json` | `narrate` (LLM mode) | LLM analysis of slide content used during narration generation |

#### Markdown-to-ExtendedMulmoScript Pipeline (`parse-md` → `/md-to-mulmo` → `assemble-extended`)

| File | Generated by | Description |
|------|-------------|-------------|
| `parsed_structure.json` | `parse-md` | Structured representation of the markdown document (sections, elements, hierarchy) |
| `extended-script.schema.json` | `parse-md` | JSON Schema for ExtendedMulmoScript (generated from Zod, for LLM reference) |
| `presentation-plan.schema.json` | `parse-md` | JSON Schema for the intermediate presentation plan format |
| `presentation_plan.json` | `/md-to-mulmo` skill (LLM) | Presentation plan with beat allocation, narration, and core/optional flags |

### `output/<basename>/` — Final Deliverables

Generated by `movie`, `bundle`, and `publish` commands.

#### Top-Level Files (generated by `mulmocast` library)

| File | Generated by | Description |
|------|-------------|-------------|
| `<basename>_<lang>.mp4` | `movie` | Final narrated video (e.g., `sample_ja.mp4`) |
| `<basename>_<lang>.mp3` | `movie`, `bundle` | Concatenated audio for the entire presentation in one language |
| `<basename>_studio.json` | `movie`, `bundle` | Studio data (timing, beat metadata) used by mulmocast internally |
| `<basename>_lang.json` | `bundle` | Multi-language translation data for the viewer |

#### `output/<basename>/<basename>/` — Bundle Directory

Contains all files needed for MulmoViewer. Generated by `bundle` (and used by `upload`/`publish`).

| File / Directory | Description |
|-----------------|-------------|
| `mulmo_view.json` | **Viewer data** — beats with audio/image references, metadata, output profiles. This is the main file the viewer reads |
| `images.001.png`, `.002.png`, ... | Slide images for the viewer |
| `beat-1.png`, `beat-2.png`, ... | Rendered slide images (for markdown-based presentations) |
| `mulmo_credit.png` | MulmoCast credit image (auto-generated) |
| `<basename>_<hash>_<lang>.mp3` | Per-beat audio files (hash identifies the text content, lang is `ja`/`en`/etc.) |
| `silent300.mp3` | Short silent audio clip used for padding between beats |

#### `output/<basename>/audio/<basename>/` and `output/<basename>/images/<basename>/`

Working directories used by `mulmocast` during generation. Contents are the same audio and image files that end up in the bundle directory.

### `extend merge` — Updates Existing Bundle

The `extend merge` command reads `scripts/<basename>/extended_script.json` and merges its metadata (beat IDs, `meta`, `scriptMeta`, `outputProfiles`, `variants`) into the existing `output/<basename>/<basename>/mulmo_view.json`. No new files are created.

### Example: Presentation Pipeline

```bash
# 1. Convert PPTX → MulmoScript
mulmo-slide pptx presentation.pptx -g -l ja

# Files created:
#   scripts/presentation/presentation.json    (MulmoScript)
#   scripts/presentation/images/              (slide PNGs)
#   scripts/presentation/presentation.pdf     (intermediate)

# 2. Generate ExtendedMulmoScript with narration
mulmo-slide narrate presentation.pptx --scaffold-only

# Files created:
#   scripts/presentation/extended_script.json (ExtendedMulmoScript)

# 3. Generate bundle for MulmoViewer
mulmo-slide bundle presentation.pptx -g -l ja

# Files created:
#   output/presentation/presentation/mulmo_view.json
#   output/presentation/presentation/*.mp3    (per-beat audio)
#   output/presentation/presentation/*.png    (slide images)
#   output/presentation/presentation_ja.mp3   (concatenated audio)
#   output/presentation/presentation_studio.json
```

### Example: Video Transcription Pipeline

```bash
# Transcribe video with Japanese translation
mulmo-slide transcribe talk.mp4 --target-langs=ja

# Files created in scripts/talk/:
#   talk.json          (MulmoScript with movie beats)
#   1.mp4, 2.mp4, ...  (split video segments)
#   1.mp3, 2.mp3, ...  (extracted audio per segment)
#   1.jpg, 2.jpg, ...  (thumbnail per segment)
#
# Files created in output/talk/talk/ (bundle):
#   mulmo_view.json    (viewer data with ja/en text + audio)
#   1.mp4, 2.mp4, ...  (video segments)
#   1_ja.mp3, 2_ja.mp3, ... (Japanese TTS audio)
```

## License

MIT
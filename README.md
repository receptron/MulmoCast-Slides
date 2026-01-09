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
  mulmo-slide marp <file>        Convert Marp markdown to MulmoScript
  mulmo-slide pptx <file>        Convert PowerPoint to MulmoScript
  mulmo-slide pdf <file>         Convert PDF to MulmoScript
  mulmo-slide keynote <file>     Convert Keynote to MulmoScript (macOS only)
  mulmo-slide movie <file>       Generate movie from presentation
  mulmo-slide bundle <file>      Generate MulmoViewer bundle from presentation
```

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

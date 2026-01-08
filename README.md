# MulmoCast-Slides

A collection of tools to convert presentation files into MulmoScript format, enabling automated narration and processing of slide decks.

## Overview

MulmoCast-Slides provides converters that extract slides and speaker notes from various presentation formats (Keynote, PowerPoint, PDF, etc.) and generate MulmoScript JSON files. Each slide is exported as an image paired with its speaker notes.

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
# With a specific file
yarn keynote path/to/presentation.key

# Interactive file selection
yarn keynote

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
# Convert a Marp markdown file
yarn marp path/to/presentation.md

# Test with sample
yarn test:marp
```

**Requirements:**
- Node.js
- @marp-team/marp-cli
- Puppeteer (installed automatically)

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
# Convert a PPTX file
yarn pptx path/to/presentation.pptx
```

**Requirements:**
- Node.js
- LibreOffice (used for PPTX to PDF conversion)
- ImageMagick (for high-quality PNG export with antialiasing)

**Output:**
- `scripts/<basename>/` - Directory named after input file
- `scripts/<basename>/images/<basename>-0.png, -1.png, ...` - PNG images of each slide
- `scripts/<basename>/mulmo_script.json` - MulmoScript JSON file

### PDF Extractor

Coming soon

## Movie Generation

Generate a movie directly from any supported presentation format.

**Usage:**

```bash
# From PowerPoint
yarn movie path/to/presentation.pptx

# From Marp markdown
yarn movie path/to/presentation.md

# From Keynote (macOS only)
yarn movie path/to/presentation.key
```

This command:
1. Converts the presentation to MulmoScript format
2. Generates audio and images using mulmocast
3. Creates the final movie

**Output:**
- `output/<basename>/` - Movie and related files

## Bundle Generation

Generate a MulmoViewer bundle directly from any supported presentation format.

**Usage:**

```bash
# From PowerPoint
yarn bundle path/to/presentation.pptx

# From Marp markdown
yarn bundle path/to/presentation.md

# From Keynote (macOS only)
yarn bundle path/to/presentation.key
```

This command:
1. Converts the presentation to MulmoScript format
2. Translates content to multiple languages (ja, en)
3. Generates audio and images
4. Creates a bundle for MulmoViewer (skipZip mode)

**Output:**
- `output/<basename>/` - Bundle files for MulmoViewer

## Upload to MulmoCast Server

Upload a generated bundle to the MulmoCast server for hosting.

**Usage:**

```bash
# Upload a bundle (after running yarn bundle)
yarn upload <basename>
```

**Requirements:**
- `MULMO_MEDIA_API_KEY` environment variable must be set

This command:
1. Finds the bundle directory at `output/<basename>/`
2. Reads `mulmo_view.json` from the bundle
3. Uploads all files to R2 storage using presigned URLs
4. Completes the upload on the server

**Example:**

```bash
# First, generate the bundle
yarn bundle samples/sample.pptx

# Then, upload it
MULMO_MEDIA_API_KEY=your-api-key yarn upload sample
```

## Installation

```bash
yarn install
```

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

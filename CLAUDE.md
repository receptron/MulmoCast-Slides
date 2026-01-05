# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MulmoCast-Slides is a tool collection for converting presentation files (Keynote, PowerPoint, PDF) into MulmoScript format. MulmoScript is a JSON-based format that pairs slide images with speaker notes for automated narration and multimedia processing.

## Key Commands

```bash
# Extract slides from a Keynote file
yarn keynote path/to/presentation.key

# Interactive Keynote file selection
yarn keynote

# Test with sample presentation
yarn test:keynote

# Extract slides from a Marp markdown file
yarn marp path/to/presentation.md

# Test with sample Marp presentation
yarn test:marp
```

## Architecture

### MulmoScript Format

MulmoScript supports two image formats:

**Format 1: PNG Images**
```json
{
  "$mulmocast": {
    "version": "1.0",
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

**Format 2: HTML Tailwind**
```json
{
  "$mulmocast": {
    "version": "1.0",
    "credit": "closing"
  },
  "beats": [
    {
      "text": "Speaker notes or narration text",
      "image": {
        "type": "html_tailwind",
        "html": [
          "<h1>Slide Title</h1>",
          "<p>Content</p>"
        ]
      }
    }
  ]
}
```

Each "beat" represents one slide with its associated speaker notes.

### Extractor Pattern

The Keynote extractor (`tools/keynote/extract.scpt`) demonstrates the common pattern all extractors should follow:

1. **Input**: Accept file path as argument or prompt for file selection
2. **Extraction**:
   - Export slides as PNG images to `output/images/`
   - Extract speaker notes/narration text for each slide
3. **MulmoScript Generation**: Combine images and text into `output/script.json`
4. **Cleanup**: Remove temporary files and sanitize filenames

### Tool Structure

- `tools/[format]/` - Each presentation format has its own subdirectory
- Extractors should be self-contained scripts that can run via yarn commands
- All extractors output to the same `output/` structure for consistency

### Output Structure

**Keynote extractor:**
```
output/
├── images/
│   ├── images.001.png
│   ├── images.002.png
│   └── ...
└── script.json
```

**Marp extractor:**
```
output/
├── images/
│   ├── images.001.png
│   ├── images.002.png
│   └── ...
├── script.json       # PNG format
└── script-html.json  # HTML Tailwind format
```

Images are numbered sequentially (001, 002, etc.) and referenced by absolute path in the script.json file.

### Platform Requirements

**Keynote extractor:**
- Requires macOS, Keynote installed, and Python 3
- Uses AppleScript for Keynote automation
- Python for JSON generation and filename sanitization

**Marp extractor:**
- Cross-platform (Node.js/TypeScript)
- Dependencies: @marp-team/marp-cli, puppeteer, tsx
- Generates both PNG and HTML outputs

### Implementation Notes

**Keynote extractor:**
- Handles a macOS bug where exported filenames contain hidden Unicode characters (U+200E Left-to-Right Mark and carriage returns) that must be removed
- Images are exported with maximum quality (PNG, compression factor 1.0)
- Speaker notes are temporarily stored using ASCII Record Separator (char 30) as delimiter to preserve multi-line content

**Marp extractor:**
- Speaker notes are extracted from HTML comments in markdown: `<!-- note text -->`
- Uses Marp CLI to render markdown to HTML
- Uses Puppeteer to capture screenshots of each slide
- Extracts slide HTML for html_tailwind format
- Generates two output files: script.json (PNG) and script-html.json (HTML)

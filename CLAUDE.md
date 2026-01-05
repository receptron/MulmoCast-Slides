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
```

## Architecture

### MulmoScript Format

The output format follows this structure:

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

```
output/
├── images/
│   ├── images.001.png
│   ├── images.002.png
│   └── ...
└── script.json
```

Images are numbered sequentially (001, 002, etc.) and referenced by absolute path in the script.json file.

### Platform Requirements

- **Keynote extractor**: Requires macOS, Keynote installed, and Python 3
- Uses AppleScript for Keynote automation
- Python for JSON generation and filename sanitization

### Implementation Notes

- The Keynote extractor handles a macOS bug where exported filenames contain hidden Unicode characters (U+200E Left-to-Right Mark and carriage returns) that must be removed
- Images are exported with maximum quality (PNG, compression factor 1.0)
- Speaker notes are temporarily stored using ASCII Record Separator (char 30) as delimiter to preserve multi-line content

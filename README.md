# MulmoCast-Slides

A collection of tools to convert presentation files into MulmoScript format, enabling automated narration and processing of slide decks.

## Overview

MulmoCast-Slides provides converters that extract slides and speaker notes from various presentation formats (Keynote, PowerPoint, PDF, etc.) and generate MulmoScript JSON files. Each slide is exported as an image paired with its speaker notes.

## MulmoScript Format

MulmoScript is a JSON-based format that combines images with text for multimedia presentations:

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
- `output/images/` - PNG images of each slide
- `output/script.json` - MulmoScript JSON file

### PowerPoint Extractor

Coming soon

### PDF Extractor

Coming soon

## Installation

```bash
yarn install
```

## Output Structure

All tools generate a consistent output structure:

```
output/
├── images/
│   ├── images.001.png
│   ├── images.002.png
│   └── ...
└── script.json
```

## License

MIT

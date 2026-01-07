# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MulmoCast-Slides is a tool collection for converting presentation files (Keynote, PowerPoint, Marp) into MulmoScript format. MulmoScript is a JSON-based format that pairs slide content with speaker notes for automated narration and multimedia processing.

## Key Commands

```bash
# Keynote presentations
yarn keynote path/to/presentation.key
yarn test:keynote

# Marp markdown presentations
yarn marp path/to/presentation.md
yarn test:marp

# PowerPoint presentations
yarn pptx path/to/presentation.pptx

# Generate movie from any format
yarn movie path/to/presentation.pptx  # or .md, .key

# Run tests
yarn test
```

## Testing

Tests are located in `tests/` directory using Node.js built-in test runner.

```bash
yarn test
```

Test files follow the naming convention `test_*.ts`.

## Architecture

### Extractor Pattern

All extractors follow a common pattern:

1. **Input**: Accept file path as argument or prompt for file selection
2. **Extraction**: Export slides and extract speaker notes
3. **Output**: Generate MulmoScript JSON file(s)
4. **Cleanup**: Remove temporary files

### Tool Structure

- `src/[format]/` - TypeScript extractors (Marp, PPTX)
- `src/movie/` - Unified movie generation script
- `tools/[format]/` - Native scripts (Keynote AppleScript)
- Extractors are self-contained scripts that run via yarn commands
- MulmoScript output goes to `scripts/` directory
- Movie output goes to `output/` directory

### Platform Requirements

- **Keynote**: macOS, Keynote app, Python 3
- **Marp**: Node.js/TypeScript, @marp-team/marp-cli
- **PPTX**: Node.js, LibreOffice, ImageMagick

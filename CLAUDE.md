# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MulmoCast-Slides is a tool collection for converting presentation files (Keynote, PowerPoint, PDF, Marp) into MulmoScript format. MulmoScript is a JSON-based format that pairs slide content with speaker notes for automated narration and multimedia processing.

## Key Commands

```bash
# Keynote presentations (macOS only)
yarn keynote path/to/presentation.key

# Marp markdown presentations
yarn marp path/to/presentation.md
yarn marp path/to/presentation.md -g -l ja  # with LLM narration generation

# PowerPoint presentations
yarn pptx path/to/presentation.pptx
yarn pptx path/to/presentation.pptx -g -l ja  # with LLM narration generation

# PDF presentations
yarn pdf path/to/presentation.pdf
yarn pdf path/to/presentation.pdf -g -l ja  # with LLM narration generation

# Generate movie from any format
yarn movie path/to/presentation.pptx  # or .md, .key, .pdf
yarn movie path/to/presentation.pptx -f -g  # force regenerate with LLM

# Generate bundle (for MulmoViewer) from any format
yarn bundle path/to/presentation.pptx  # or .md, .key, .pdf
yarn bundle path/to/presentation.pptx -f -g  # force regenerate with LLM

# Upload bundle to MulmoCast server
yarn upload <basename>  # requires MULMO_MEDIA_API_KEY env var

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

- `src/convert/` - TypeScript converters (marp.ts, pptx.ts, pdf.ts)
- `src/actions/` - Action scripts (movie, bundle, upload) with shared utilities
- `src/utils/` - Shared utilities (lang.ts, llm.ts, pdf.ts)
- `tools/keynote/` - Keynote AppleScript extractor
- MulmoScript output goes to `scripts/` directory
- Movie/Bundle output goes to `output/` directory

### Platform Requirements

- **Keynote**: macOS, Keynote app, Python 3
- **Marp**: Node.js/TypeScript, @marp-team/marp-cli
- **PPTX**: Node.js, LibreOffice, ImageMagick
- **PDF**: Node.js, ImageMagick

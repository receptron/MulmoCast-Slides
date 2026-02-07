# /extend - MulmoScript to ExtendedScript Conversion

Convert a MulmoScript JSON into an ExtendedScript by adding `scriptMeta` and `beats[].meta` metadata fields. The metadata is used by mulmocast-preprocessor's AI features (summarize, query).

## Invocation

```
/extend <mulmo_script.json path> [--source <source file path>]
```

## Instructions

### Step 1: Read Inputs

1. Read the MulmoScript JSON at the specified path
2. Read the ExtendedScript schema: `.claude/skills/extend/references/extended-script-schema.md`
3. Locate the source file:
   - If `--source` is specified, use that file
   - Otherwise, infer from the MulmoScript path:
     - `scripts/{basename}/mulmo_script.json` -> search for `samples/{basename}.*` (try `.md`, `.pptx`, `.pdf`, `.key`)
   - If no source file found, work from the MulmoScript content alone
4. If a source file is found, read it

### Step 2: Analyze Content

Analyze the MulmoScript beats and source file (if available) to understand:

- The overall theme and purpose of the presentation
- The target audience
- The logical structure (sections, flow)
- Content types in each slide (text, code, diagrams, tables, data)
- URLs and external references mentioned
- Key terminology and concepts

For Markdown sources, also examine:
- Header hierarchy and structure
- Speaker notes (after `---` or in HTML comments)
- Code blocks and their languages
- Mermaid diagrams
- Links and references

### Step 3: Generate Metadata

Based on the analysis, generate:

**`scriptMeta`** (script-level):
- `background`: 1-2 sentence overview of the presentation's theme
- `audience`: Who this presentation is for
- `goals`: 2-4 learning objectives or presentation goals
- `keywords`: 5-10 main keywords for search/discovery
- `references`: Extract URLs from slides, categorize as web/code/document/video
- `author`: If identifiable from content
- `faq`: 2-4 likely questions with answers based on the content

**`beats[].meta`** (per-beat):
- `section`: Logical section name (e.g., "opening", "introduction", "main-topic-1", "demo", "closing")
  - Use consistent naming: consecutive beats in the same logical section share the same section value
- `tags`: Content type and topic tags. Use from this vocabulary when applicable:
  - Content type: `intro`, `overview`, `definition`, `example`, `code`, `diagram`, `data`, `table`, `demo`, `comparison`, `summary`, `conclusion`, `q-and-a`
  - Add topic-specific tags as needed
- `keywords`: 2-5 beat-specific important terms
- `context`: Background information NOT already in the slide text that would help an AI answer questions about this beat. Include related concepts, technical details, or connections to other topics. This is the most valuable field - be substantive.
- `expectedQuestions`: 1-3 questions the audience might ask about this specific beat's content

### Step 4: Build ExtendedScript

1. Start with the original MulmoScript (preserve ALL existing fields exactly)
2. Add `scriptMeta` at the top level
3. Add `meta` to each beat
4. Add `outputProfiles: {}` (empty, for user to configure later)
5. If beats don't have `id` fields, add them (e.g., `"beat-1"`, `"beat-2"`, ...)

### Step 5: Write Output

1. Determine output path:
   - Same directory as input: replace `mulmo_script.json` with `extended_script.json`
   - Example: `scripts/simple_text/mulmo_script.json` -> `scripts/simple_text/extended_script.json`
2. Write the JSON with 2-space indentation
3. Display a summary to the user:
   - Number of beats processed
   - Sections identified
   - Key topics/keywords
   - Output file path

### Step 6: Offer Adjustments

Ask the user if they want to adjust any of the generated metadata. Common adjustments:
- Refine audience description
- Add/remove keywords
- Adjust FAQ entries
- Modify section boundaries
- Enhance context fields

## Quality Guidelines

- **context field**: This is the most important field for AI features. Don't just restate the slide text. Add supplementary information: related concepts, technical background, real-world examples, historical context, common misconceptions.
- **section naming**: Use lowercase-kebab-case. Keep section names meaningful and consistent across beats.
- **tags**: Be specific but not excessive. 2-4 tags per beat is typical.
- **expectedQuestions**: Write natural questions a real audience member would ask, not generic ones.
- **keywords**: Prefer specific technical terms over generic words.
- **Preserve original content**: Never modify existing MulmoScript fields (text, image, speaker, etc.).

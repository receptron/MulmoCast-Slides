import type { SupportedLang } from "./lang.js";
import { getLanguageName, extractJsonFromResponse } from "./llm.js";

export interface SectionInfo {
  name: string;
  pages: number[];
  summary: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigureInfo {
  page: number;
  type: "figure" | "table" | "chart" | "diagram";
  label?: string;
  description: string;
  importance: "high" | "medium" | "low";
  bbox?: BoundingBox;
}

export interface SlideSpec {
  title: string;
  section: string;
  sourcePages: number[];
  imagePage?: number;
  figureRef?: string;
  narrationHint: string;
}

export interface DocumentAnalysis {
  title: string;
  authors?: string;
  sections: SectionInfo[];
  figures: FigureInfo[];
  slides: SlideSpec[];
}

export interface BuildAnalysisPromptOptions {
  pageCount: number;
  extractedTexts: string[];
  lang: SupportedLang;
}

export const buildDocumentAnalysisPrompt = (options: BuildAnalysisPromptOptions): string => {
  const { pageCount, extractedTexts, lang } = options;
  const languageName = getLanguageName(lang);

  const textSummaries = extractedTexts
    .map((text, i) => {
      if (!text || text.trim().length === 0) return `--- Page ${i} ---\n(no text)`;
      const truncated = text.length > 2000 ? text.slice(0, 2000) + "..." : text;
      return `--- Page ${i} ---\n${truncated}`;
    })
    .join("\n\n");

  return `You are analyzing a PDF document to create an engaging presentation.

The document has ${pageCount} pages. I'm showing you all pages as images and providing extracted text.

Extracted text per page:
${textSummaries}

Analyze the document and create a presentation plan. Respond in JSON:

{
  "title": "document title",
  "authors": "author names if identifiable",
  "sections": [
    {
      "name": "section name",
      "pages": [0, 1],
      "summary": "brief section summary"
    }
  ],
  "figures": [
    {
      "page": 0,
      "type": "figure|table|chart|diagram",
      "label": "Figure 1",
      "description": "what the figure shows",
      "importance": "high|medium|low",
      "bbox": {"x": 10, "y": 30, "width": 80, "height": 40}
    }
  ],
  "slides": [
    {
      "title": "slide title in ${languageName}",
      "section": "section name",
      "sourcePages": [0, 1],
      "imagePage": 0,
      "figureRef": "Figure 1",
      "narrationHint": "key points to explain in this slide"
    }
  ]
}

Guidelines:
- "sections": identify the logical structure of the document (intro, main sections, conclusion, etc.)
- "figures": identify ALL figures, tables, charts, and diagrams. Mark important ones as "high"
  - "bbox": bounding box as percentage of page dimensions (0-100). x = left edge %, y = top edge %, width and height in %.
    IMPORTANT: err on the side of LARGER bounding boxes. Add 3-5% extra margin on all sides. It is much better to include a bit of surrounding whitespace than to cut off any part of the figure, its axis labels, legends, title, or caption.
    Include the full figure with ALL labels, axis text, legends, and captions.
    For a figure in the lower-left quadrant: {"x": 2, "y": 50, "width": 50, "height": 48}
- "slides": create a presentation that explains the document to an audience
  - NOT 1:1 with pages. Group related content, split dense pages
  - Each important figure (high importance) should get its own slide
  - "imagePage": which page image to show for this slide (0-based)
  - "title": write in ${languageName}
  - "narrationHint": describe what the presenter should explain (in English for clarity)
  - Typical slide count: 8-15 slides for a 10-20 page document
  - Include an introduction slide and a conclusion/summary slide
- Skip appendix/reference pages unless they contain critical content
- "figureRef": reference a figure label from the figures array when the slide focuses on that figure

Respond ONLY with valid JSON.`;
};

export const parseDocumentAnalysis = (content: string): DocumentAnalysis => {
  const jsonStr = extractJsonFromResponse(content);
  const parsed = JSON.parse(jsonStr);

  const analysis: DocumentAnalysis = {
    title: parsed.title ?? "Untitled",
    authors: parsed.authors,
    sections: (parsed.sections ?? []).map((s: Record<string, unknown>) => ({
      name: String(s.name ?? ""),
      pages: Array.isArray(s.pages) ? s.pages.map(Number) : [],
      summary: String(s.summary ?? ""),
    })),
    figures: (parsed.figures ?? []).map((f: Record<string, unknown>) => {
      const bbox = f.bbox as Record<string, unknown> | undefined;
      const parsedBbox =
        bbox && bbox.x != null && bbox.y != null && bbox.width != null && bbox.height != null
          ? {
              x: Number(bbox.x),
              y: Number(bbox.y),
              width: Number(bbox.width),
              height: Number(bbox.height),
            }
          : undefined;
      return {
        page: Number(f.page ?? 0),
        type: String(f.type ?? "figure") as FigureInfo["type"],
        label: f.label ? String(f.label) : undefined,
        description: String(f.description ?? ""),
        importance: String(f.importance ?? "medium") as FigureInfo["importance"],
        bbox: parsedBbox,
      };
    }),
    slides: (parsed.slides ?? []).map((s: Record<string, unknown>) => ({
      title: String(s.title ?? ""),
      section: String(s.section ?? ""),
      sourcePages: Array.isArray(s.sourcePages) ? s.sourcePages.map(Number) : [],
      imagePage: s.imagePage != null ? Number(s.imagePage) : undefined,
      figureRef: s.figureRef ? String(s.figureRef) : undefined,
      narrationHint: String(s.narrationHint ?? ""),
    })),
  };

  if (analysis.slides.length === 0) {
    throw new Error("DocumentAnalysis has no slides");
  }

  return analysis;
};

import type { ExtendedMulmoViewerData, ExtendedMulmoViewerBeat } from "@mulmocast/extended-types";

type BeatMeta = NonNullable<ExtendedMulmoViewerBeat["meta"]>;
type ScriptMeta = NonNullable<ExtendedMulmoViewerData["scriptMeta"]>;

function buildBeatContent(beat: ExtendedMulmoViewerBeat, index: number): string {
  const lines: string[] = [];
  const text = beat.text ?? "";
  lines.push(`[${index}] ${text}`);

  const meta: BeatMeta | undefined = beat.meta;
  if (!meta) return lines.join("\n");

  if (meta.tags && meta.tags.length > 0) {
    lines.push(`  Tags: ${meta.tags.join(", ")}`);
  }
  if (meta.keywords && meta.keywords.length > 0) {
    lines.push(`  Keywords: ${meta.keywords.join(", ")}`);
  }
  if (meta.expectedQuestions && meta.expectedQuestions.length > 0) {
    meta.expectedQuestions.forEach((q) => {
      lines.push(`  Can answer: ${q}`);
    });
  }
  if (meta.context) {
    lines.push(`  Context: ${meta.context}`);
  }
  if (meta.notes) {
    lines.push(`  Notes: ${meta.notes}`);
  }

  return lines.join("\n");
}

function buildScriptMetaContent(scriptMeta: ScriptMeta): string {
  const lines: string[] = [];
  lines.push("## About this content");

  if (scriptMeta.background) {
    lines.push(`Background: ${scriptMeta.background}`);
  }
  if (scriptMeta.audience) {
    lines.push(`Target audience: ${scriptMeta.audience}`);
  }
  if (scriptMeta.goals && scriptMeta.goals.length > 0) {
    lines.push(`Goals: ${scriptMeta.goals.join(", ")}`);
  }
  if (scriptMeta.prerequisites && scriptMeta.prerequisites.length > 0) {
    lines.push(`Prerequisites: ${scriptMeta.prerequisites.join(", ")}`);
  }
  if (scriptMeta.keywords && scriptMeta.keywords.length > 0) {
    lines.push(`Keywords: ${scriptMeta.keywords.join(", ")}`);
  }
  if (scriptMeta.faq && scriptMeta.faq.length > 0) {
    lines.push("FAQ:");
    scriptMeta.faq.forEach((item) => {
      lines.push(`  Q: ${item.question}`);
      lines.push(`  A: ${item.answer}`);
    });
  }
  if (scriptMeta.author) {
    lines.push(`Author: ${scriptMeta.author}`);
  }

  return lines.join("\n");
}

function buildContext(data: ExtendedMulmoViewerData): string {
  const lines: string[] = [];

  const title = data.title ?? "Untitled Presentation";
  lines.push(`# Presentation: ${title}`);
  lines.push("");

  if (data.scriptMeta) {
    lines.push(buildScriptMetaContent(data.scriptMeta));
    lines.push("");
  }

  // Group beats by section
  const sections = new Map<string, { beat: ExtendedMulmoViewerBeat; index: number }[]>();
  data.beats.forEach((beat, index) => {
    const section = beat.meta?.section ?? "(no section)";
    const existing = sections.get(section) ?? [];
    existing.push({ beat, index });
    sections.set(section, existing);
  });

  sections.forEach((beats, section) => {
    lines.push(`## Section: ${section}`);
    beats.forEach(({ beat, index }) => {
      lines.push(buildBeatContent(beat, index));
    });
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export { buildBeatContent, buildScriptMetaContent, buildContext };

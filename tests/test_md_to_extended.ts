import { describe, it } from "node:test";
import assert from "node:assert";
import {
  assembleExtendedMulmoScript,
  validatePresentationPlan,
  validateExtendedMulmoScript,
} from "../src/actions/md-to-extended.js";

const makeMinimalPlan = (overrides = {}) => ({
  lang: "ja",
  title: "Test Presentation",
  scriptMeta: {
    audience: "Developers",
    goals: ["Understand the system"],
    keywords: ["test", "example"],
  },
  beats: [
    {
      id: "beat-1",
      sourceSections: ["sec-0"],
      slideMarkdown: "# Introduction\n\n- Point 1\n- Point 2",
      narration: "This is the introduction.",
      shortNarration: "Quick intro.",
      isCore: true,
      meta: {
        section: "introduction",
        tags: ["intro"],
        context: "Background context",
        keywords: ["intro"],
        expectedQuestions: ["What is this about?"],
      },
    },
  ],
  ...overrides,
});

describe("validatePresentationPlan", () => {
  it("accepts valid plan", () => {
    const result = validatePresentationPlan(makeMinimalPlan());
    assert.strictEqual(result.success, true);
  });

  it("rejects plan without beats", () => {
    const result = validatePresentationPlan(makeMinimalPlan({ beats: [] }));
    assert.strictEqual(result.success, false);
  });

  it("rejects plan without lang", () => {
    const plan = makeMinimalPlan();
    delete (plan as Record<string, unknown>).lang;
    const result = validatePresentationPlan(plan);
    assert.strictEqual(result.success, false);
  });

  it("accepts plan with null shortNarration", () => {
    const plan = makeMinimalPlan();
    plan.beats[0].shortNarration = null;
    const result = validatePresentationPlan(plan);
    assert.strictEqual(result.success, true);
  });

  it("accepts plan with optional scriptMeta fields", () => {
    const plan = makeMinimalPlan({
      scriptMeta: {
        audience: "Everyone",
        references: [{ type: "web", url: "https://example.com", title: "Example" }],
        faq: [{ question: "What?", answer: "This." }],
      },
    });
    const result = validatePresentationPlan(plan);
    assert.strictEqual(result.success, true);
  });
});

describe("assembleExtendedMulmoScript", () => {
  it("creates ExtendedMulmoScript with correct structure", () => {
    const plan = makeMinimalPlan();
    const result = assembleExtendedMulmoScript(plan);

    assert.strictEqual(result.lang, "ja");
    assert.strictEqual(result.beats.length, 1);
    assert.ok(result.outputProfiles);
    assert.ok(result.scriptMeta);
  });

  it("sets outputProfiles with detailed and short", () => {
    const plan = makeMinimalPlan();
    const result = assembleExtendedMulmoScript(plan);

    assert.ok(result.outputProfiles?.detailed);
    assert.ok(result.outputProfiles?.short);
    assert.strictEqual(result.outputProfiles?.detailed.name, "Detailed");
    assert.strictEqual(result.outputProfiles?.short.name, "Short");
  });

  it("converts core beat with shortNarration to short variant", () => {
    const plan = makeMinimalPlan();
    const result = assembleExtendedMulmoScript(plan);

    const beat = result.beats[0];
    assert.ok(beat.variants?.short);
    assert.strictEqual(beat.variants?.short.text, "Quick intro.");
    assert.strictEqual(beat.variants?.short.skip, undefined);
  });

  it("converts non-core beat to short variant with skip", () => {
    const plan = makeMinimalPlan();
    plan.beats[0].isCore = false;
    plan.beats[0].shortNarration = null;
    const result = assembleExtendedMulmoScript(plan);

    const beat = result.beats[0];
    assert.ok(beat.variants?.short);
    assert.strictEqual(beat.variants?.short.skip, true);
  });

  it("omits variants for core beat without shortNarration", () => {
    const plan = makeMinimalPlan();
    plan.beats[0].shortNarration = undefined;
    const result = assembleExtendedMulmoScript(plan);

    const beat = result.beats[0];
    assert.strictEqual(beat.variants, undefined);
  });

  it("sets beat text from narration", () => {
    const plan = makeMinimalPlan();
    const result = assembleExtendedMulmoScript(plan);

    assert.strictEqual(result.beats[0].text, "This is the introduction.");
  });

  it("sets beat image as markdown type", () => {
    const plan = makeMinimalPlan();
    const result = assembleExtendedMulmoScript(plan);

    const image = result.beats[0].image;
    assert.ok(image);
    assert.strictEqual(image.type, "markdown");
  });

  it("preserves beat metadata", () => {
    const plan = makeMinimalPlan();
    const result = assembleExtendedMulmoScript(plan);

    const meta = result.beats[0].meta;
    assert.ok(meta);
    assert.strictEqual(meta.section, "introduction");
    assert.deepStrictEqual(meta.tags, ["intro"]);
  });

  it("handles multiple beats with mixed core/optional", () => {
    const plan = makeMinimalPlan({
      beats: [
        {
          id: "beat-1",
          sourceSections: ["sec-0"],
          slideMarkdown: "# Intro",
          narration: "Intro text",
          shortNarration: "Short intro",
          isCore: true,
          meta: { section: "intro", tags: ["intro"] },
        },
        {
          id: "beat-2",
          sourceSections: ["sec-1"],
          slideMarkdown: "# Details",
          narration: "Detailed explanation",
          shortNarration: null,
          isCore: false,
          meta: { section: "details", tags: ["example"] },
        },
        {
          id: "beat-3",
          sourceSections: ["sec-2"],
          slideMarkdown: "# Conclusion",
          narration: "Conclusion text",
          shortNarration: "Brief conclusion",
          isCore: true,
          meta: { section: "conclusion", tags: ["conclusion"] },
        },
      ],
    });

    const result = assembleExtendedMulmoScript(plan);
    assert.strictEqual(result.beats.length, 3);

    // beat-1: core with short text
    assert.strictEqual(result.beats[0].variants?.short?.text, "Short intro");

    // beat-2: non-core, skip in short
    assert.strictEqual(result.beats[1].variants?.short?.skip, true);

    // beat-3: core with short text
    assert.strictEqual(result.beats[2].variants?.short?.text, "Brief conclusion");

    // Profile description counts
    assert.ok(result.outputProfiles?.short.description?.includes("2 slides"));
    assert.ok(result.outputProfiles?.short.description?.includes("1 skipped"));
  });
});

describe("validateExtendedMulmoScript", () => {
  it("validates assembled output", () => {
    const plan = makeMinimalPlan();
    const assembled = assembleExtendedMulmoScript(plan);
    const result = validateExtendedMulmoScript(assembled);
    assert.strictEqual(result.success, true);
  });

  it("rejects invalid data", () => {
    const result = validateExtendedMulmoScript({ invalid: true });
    assert.strictEqual(result.success, false);
  });
});

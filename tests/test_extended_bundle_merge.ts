import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  mergeExtendedMetadata,
  type ExtendedMulmoViewerData,
} from "../src/utils/extended-bundle-merge.js";

const makeViewerData = (overrides: Record<string, unknown> = {}) => ({
  beats: [
    {
      text: "Hello world",
      duration: 5,
      startTime: 0,
      endTime: 5,
      audioSources: { ja: "audio_0_ja.mp3" },
      imageSource: "slide_0.png",
    },
    {
      text: "Second slide",
      duration: 3,
      startTime: 5,
      endTime: 8,
      audioSources: { ja: "audio_1_ja.mp3" },
      imageSource: "slide_1.png",
    },
  ],
  title: "Test Presentation",
  bgmSource: "bgm.mp3",
  ...overrides,
});

const makeExtendedScript = (overrides: Record<string, unknown> = {}) => ({
  $mulmocast: { version: "1.1" },
  speechParams: { speakers: {} },
  imageParams: { provider: "openai", images: {} },
  beats: [
    {
      id: "intro",
      text: "Hello world",
      meta: { tags: ["intro"], section: "opening", notes: "Opening slide" },
      variants: {
        short: { text: "Hi!", skip: false },
        detailed: { text: "Hello world, welcome to this presentation" },
      },
    },
    {
      id: "content-1",
      text: "Second slide",
      meta: { section: "main", keywords: ["topic"] },
      variants: {
        short: { skip: true },
      },
    },
  ],
  scriptMeta: { audience: "developers", keywords: ["test", "demo"] },
  outputProfiles: {
    short: { name: "Short version", description: "Condensed" },
    detailed: { name: "Detailed version" },
  },
  ...overrides,
});

const setupTempDirs = () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "merge-test-"));
  const bundleDir = path.join(tmpDir, "bundle");
  const scriptsDir = path.join(tmpDir, "scripts");
  fs.mkdirSync(bundleDir, { recursive: true });
  fs.mkdirSync(scriptsDir, { recursive: true });
  return { tmpDir, bundleDir, scriptsDir };
};

const writeJson = (filePath: string, data: unknown) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const readJson = <T>(filePath: string): T => {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
};

const cleanupDir = (dir: string) => {
  fs.rmSync(dir, { recursive: true, force: true });
};

test("merge: adds id, meta, variants to each beat", () => {
  const { tmpDir, bundleDir, scriptsDir } = setupTempDirs();
  try {
    writeJson(path.join(bundleDir, "mulmo_view.json"), makeViewerData());
    writeJson(path.join(scriptsDir, "extended_script.json"), makeExtendedScript());

    mergeExtendedMetadata(bundleDir, scriptsDir);

    const result = readJson<ExtendedMulmoViewerData>(
      path.join(bundleDir, "mulmo_view.json"),
    );

    assert.strictEqual(result.beats[0].id, "intro");
    assert.deepStrictEqual(result.beats[0].meta, {
      tags: ["intro"],
      section: "opening",
      notes: "Opening slide",
    });
    assert.deepStrictEqual(result.beats[0].variants, {
      short: { text: "Hi!", skip: false },
      detailed: { text: "Hello world, welcome to this presentation" },
    });

    assert.strictEqual(result.beats[1].id, "content-1");
    assert.deepStrictEqual(result.beats[1].meta, {
      section: "main",
      keywords: ["topic"],
    });
    assert.deepStrictEqual(result.beats[1].variants, {
      short: { skip: true },
    });
  } finally {
    cleanupDir(tmpDir);
  }
});

test("merge: copies scriptMeta and outputProfiles to top level", () => {
  const { tmpDir, bundleDir, scriptsDir } = setupTempDirs();
  try {
    writeJson(path.join(bundleDir, "mulmo_view.json"), makeViewerData());
    writeJson(path.join(scriptsDir, "extended_script.json"), makeExtendedScript());

    mergeExtendedMetadata(bundleDir, scriptsDir);

    const result = readJson<ExtendedMulmoViewerData>(
      path.join(bundleDir, "mulmo_view.json"),
    );

    assert.deepStrictEqual(result.scriptMeta, {
      audience: "developers",
      keywords: ["test", "demo"],
    });
    assert.deepStrictEqual(result.outputProfiles, {
      short: { name: "Short version", description: "Condensed" },
      detailed: { name: "Detailed version" },
    });
  } finally {
    cleanupDir(tmpDir);
  }
});

test("merge: preserves existing viewer beat fields", () => {
  const { tmpDir, bundleDir, scriptsDir } = setupTempDirs();
  try {
    writeJson(path.join(bundleDir, "mulmo_view.json"), makeViewerData());
    writeJson(path.join(scriptsDir, "extended_script.json"), makeExtendedScript());

    mergeExtendedMetadata(bundleDir, scriptsDir);

    const result = readJson<ExtendedMulmoViewerData>(
      path.join(bundleDir, "mulmo_view.json"),
    );

    assert.strictEqual(result.beats[0].text, "Hello world");
    assert.strictEqual(result.beats[0].duration, 5);
    assert.strictEqual(result.beats[0].startTime, 0);
    assert.strictEqual(result.beats[0].endTime, 5);
    assert.deepStrictEqual(result.beats[0].audioSources, { ja: "audio_0_ja.mp3" });
    assert.strictEqual(result.beats[0].imageSource, "slide_0.png");
    assert.strictEqual(result.title, "Test Presentation");
    assert.strictEqual(result.bgmSource, "bgm.mp3");
  } finally {
    cleanupDir(tmpDir);
  }
});

test("merge: no-op when extended_script.json does not exist", () => {
  const { tmpDir, bundleDir, scriptsDir } = setupTempDirs();
  try {
    const viewerData = makeViewerData();
    writeJson(path.join(bundleDir, "mulmo_view.json"), viewerData);
    // No extended_script.json written

    mergeExtendedMetadata(bundleDir, scriptsDir);

    const result = readJson<ExtendedMulmoViewerData>(
      path.join(bundleDir, "mulmo_view.json"),
    );

    assert.deepStrictEqual(result, viewerData);
  } finally {
    cleanupDir(tmpDir);
  }
});

test("merge: throws when extended has more beats than viewer", () => {
  const { tmpDir, bundleDir, scriptsDir } = setupTempDirs();
  try {
    writeJson(path.join(bundleDir, "mulmo_view.json"), makeViewerData({
      beats: [{ text: "Only one", duration: 3 }],
    }));
    writeJson(path.join(scriptsDir, "extended_script.json"), makeExtendedScript());

    assert.throws(
      () => mergeExtendedMetadata(bundleDir, scriptsDir),
      /Beat count mismatch/,
    );
  } finally {
    cleanupDir(tmpDir);
  }
});

test("merge: throws when viewer has more beats than extended", () => {
  const { tmpDir, bundleDir, scriptsDir } = setupTempDirs();
  try {
    writeJson(path.join(bundleDir, "mulmo_view.json"), makeViewerData());
    writeJson(
      path.join(scriptsDir, "extended_script.json"),
      makeExtendedScript({
        beats: [{ id: "only-one", text: "Only one" }],
      }),
    );

    assert.throws(
      () => mergeExtendedMetadata(bundleDir, scriptsDir),
      /Beat count mismatch/,
    );
  } finally {
    cleanupDir(tmpDir);
  }
});

test("merge: strips image/imagePrompt from variants, keeps text/skip only", () => {
  const { tmpDir, bundleDir, scriptsDir } = setupTempDirs();
  try {
    writeJson(path.join(bundleDir, "mulmo_view.json"), makeViewerData());
    writeJson(
      path.join(scriptsDir, "extended_script.json"),
      makeExtendedScript({
        beats: [
          {
            id: "beat-1",
            text: "Slide one",
            variants: {
              short: {
                text: "Brief",
                skip: false,
                image: { type: "markdown", markdown: "# Title" },
                imagePrompt: "a fancy image",
              },
            },
          },
          { id: "beat-2", text: "Slide two" },
        ],
      }),
    );

    mergeExtendedMetadata(bundleDir, scriptsDir);

    const result = readJson<ExtendedMulmoViewerData>(
      path.join(bundleDir, "mulmo_view.json"),
    );

    assert.deepStrictEqual(result.beats[0].variants, {
      short: { text: "Brief", skip: false },
    });
  } finally {
    cleanupDir(tmpDir);
  }
});

test("merge: skips empty scriptMeta and outputProfiles", () => {
  const { tmpDir, bundleDir, scriptsDir } = setupTempDirs();
  try {
    writeJson(path.join(bundleDir, "mulmo_view.json"), makeViewerData());
    writeJson(
      path.join(scriptsDir, "extended_script.json"),
      makeExtendedScript({ scriptMeta: {}, outputProfiles: {} }),
    );

    mergeExtendedMetadata(bundleDir, scriptsDir);

    const result = readJson<ExtendedMulmoViewerData>(
      path.join(bundleDir, "mulmo_view.json"),
    );

    assert.strictEqual(result.scriptMeta, undefined);
    assert.strictEqual(result.outputProfiles, undefined);
  } finally {
    cleanupDir(tmpDir);
  }
});

test("merge: beats without id/meta/variants remain unchanged", () => {
  const { tmpDir, bundleDir, scriptsDir } = setupTempDirs();
  try {
    writeJson(path.join(bundleDir, "mulmo_view.json"), makeViewerData());
    writeJson(
      path.join(scriptsDir, "extended_script.json"),
      makeExtendedScript({
        beats: [
          { text: "Plain beat" },
          { text: "Another plain beat" },
        ],
      }),
    );

    mergeExtendedMetadata(bundleDir, scriptsDir);

    const result = readJson<ExtendedMulmoViewerData>(
      path.join(bundleDir, "mulmo_view.json"),
    );

    assert.strictEqual(result.beats[0].id, undefined);
    assert.strictEqual(result.beats[0].meta, undefined);
    assert.strictEqual(result.beats[0].variants, undefined);
    assert.strictEqual(result.beats[0].text, "Hello world");
  } finally {
    cleanupDir(tmpDir);
  }
});

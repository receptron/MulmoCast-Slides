import test from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";

const CLI = "npx tsx src/cli.ts";

const createTempFile = (content: string, filename: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extend-validate-"));
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
};

const cleanupTempFile = (filePath: string): void => {
  const dir = path.dirname(filePath);
  fs.rmSync(dir, { recursive: true, force: true });
};

const validExtendedScript = JSON.stringify({
  $mulmocast: { version: "1.1" },
  speechParams: { speakers: {} },
  imageParams: { provider: "openai", images: {} },
  beats: [
    {
      text: "Hello world",
      meta: {
        tags: ["intro"],
        section: "opening",
        context: "Opening slide",
        keywords: ["hello"],
        expectedQuestions: ["What is this?"],
      },
    },
    {
      text: "Main content",
      meta: {
        tags: ["content"],
        section: "main",
        context: "Main section",
      },
    },
  ],
  scriptMeta: {
    audience: "developers",
    goals: ["Learn the basics"],
    keywords: ["test"],
    background: "A test presentation",
  },
  outputProfiles: {},
});

const validMinimalScript = JSON.stringify({
  $mulmocast: { version: "1.1" },
  speechParams: { speakers: {} },
  imageParams: { provider: "openai", images: {} },
  beats: [{ text: "slide 1" }],
});

const invalidScript = JSON.stringify({
  beats: [{ text: "no mulmocast header" }],
});

test("extend validate: valid ExtendedScript passes", () => {
  const filePath = createTempFile(validExtendedScript, "valid.json");
  try {
    const output = execSync(`${CLI} extend validate "${filePath}"`, { encoding: "utf-8" });
    assert.ok(output.includes("Valid ExtendedScript"));
    assert.ok(output.includes("Beats: 2"));
    assert.ok(output.includes("ScriptMeta: yes"));
    assert.ok(output.includes("Meta coverage: 100%"));
    assert.ok(output.includes("opening"));
    assert.ok(output.includes("main"));
  } finally {
    cleanupTempFile(filePath);
  }
});

test("extend validate: valid minimal script passes", () => {
  const filePath = createTempFile(validMinimalScript, "minimal.json");
  try {
    const output = execSync(`${CLI} extend validate "${filePath}"`, { encoding: "utf-8" });
    assert.ok(output.includes("Valid ExtendedScript"));
    assert.ok(output.includes("Beats: 1"));
    assert.ok(output.includes("ScriptMeta: no"));
    assert.ok(output.includes("Meta coverage: 0%"));
  } finally {
    cleanupTempFile(filePath);
  }
});

test("extend validate: invalid script fails", () => {
  const filePath = createTempFile(invalidScript, "invalid.json");
  try {
    assert.throws(
      () => execSync(`${CLI} extend validate "${filePath}"`, { encoding: "utf-8" }),
      (err: unknown) => {
        const error = err as { stderr: string };
        return error.stderr.includes("Validation failed");
      }
    );
  } finally {
    cleanupTempFile(filePath);
  }
});

test("extend validate: non-existent file fails", () => {
  assert.throws(
    () => execSync(`${CLI} extend validate /tmp/does-not-exist.json`, { encoding: "utf-8" }),
    (err: unknown) => {
      const error = err as { stderr: string };
      return error.stderr.includes("File not found");
    }
  );
});

test("extend validate: invalid JSON fails", () => {
  const filePath = createTempFile("{ not valid json", "bad.json");
  try {
    assert.throws(
      () => execSync(`${CLI} extend validate "${filePath}"`, { encoding: "utf-8" }),
      (err: unknown) => {
        const error = err as { stderr: string };
        return error.stderr.includes("Failed to parse JSON");
      }
    );
  } finally {
    cleanupTempFile(filePath);
  }
});

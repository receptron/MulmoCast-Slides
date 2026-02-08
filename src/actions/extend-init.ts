import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const SKILL_DIRS = [".claude/skills/extend", ".claude/skills/narrate"];

const getPackageRoot = (): string => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  // From lib/actions/ or src/actions/, go up two levels to package root
  return path.resolve(currentDir, "..", "..");
};

const copyDirRecursive = (src: string, dest: string): number => {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let count = 0;

  entries.forEach((entry) => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  });

  return count;
};

export const runExtendInit = (): void => {
  const packageRoot = getPackageRoot();
  let totalFiles = 0;

  SKILL_DIRS.forEach((skillDir) => {
    const srcSkillDir = path.join(packageRoot, skillDir);

    if (!fs.existsSync(srcSkillDir)) {
      console.warn(`Skill files not found at: ${srcSkillDir}, skipping`);
      return;
    }

    const destSkillDir = path.join(process.cwd(), skillDir);

    if (fs.existsSync(destSkillDir)) {
      console.log(`Overwriting: ${destSkillDir}`);
    }

    const fileCount = copyDirRecursive(srcSkillDir, destSkillDir);
    totalFiles += fileCount;
    console.log(`  ${skillDir}/ (${fileCount} files)`);
  });

  console.log(`\nInstalled skills (${totalFiles} files total)`);
  console.log(`\nUsage in Claude Code:`);
  console.log(`  /narrate <source file>         Full pipeline (recommended)`);
  console.log(`  /extend <MulmoScript.json>     Add metadata to existing MulmoScript`);
};

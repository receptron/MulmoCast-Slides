import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const SKILL_DIR = ".claude/skills/extend";

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
  const srcSkillDir = path.join(packageRoot, SKILL_DIR);

  if (!fs.existsSync(srcSkillDir)) {
    console.error(`Skill files not found at: ${srcSkillDir}`);
    process.exit(1);
  }

  const destSkillDir = path.join(process.cwd(), SKILL_DIR);

  if (fs.existsSync(destSkillDir)) {
    console.log(`Skill directory already exists: ${destSkillDir}`);
    console.log("Overwriting with latest version...");
  }

  const fileCount = copyDirRecursive(srcSkillDir, destSkillDir);

  console.log(`\nInstalled /extend skill (${fileCount} files)`);
  console.log(`  ${destSkillDir}/`);
  console.log(`\nUsage: In Claude Code, run /extend <mulmo_script.json>`);
};

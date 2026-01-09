import { execSync } from "child_process";
import * as os from "os";

export interface Dependency {
  name: string;
  commands: string[]; // Commands to check (first found = OK)
  macInstall: string;
  linuxInstall: string;
}

const DEPENDENCIES: Record<string, Dependency> = {
  imagemagick: {
    name: "ImageMagick",
    commands: ["magick", "convert"],
    macInstall: "brew install imagemagick",
    linuxInstall: "sudo apt-get install -y imagemagick",
  },
  ghostscript: {
    name: "Ghostscript",
    commands: ["gs"],
    macInstall: "brew install ghostscript",
    linuxInstall: "sudo apt-get install -y ghostscript",
  },
  libreoffice: {
    name: "LibreOffice",
    commands: ["soffice", "libreoffice"],
    macInstall: "brew install --cask libreoffice",
    linuxInstall: "sudo apt-get install -y libreoffice",
  },
};

// Commands required for each converter type
export const CONVERTER_DEPENDENCIES: Record<string, string[]> = {
  pptx: ["libreoffice", "imagemagick", "ghostscript"],
  pdf: ["imagemagick", "ghostscript"],
  marp: [], // No external dependencies
  keynote: [], // Requires Keynote app, checked separately
};

function commandExists(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkDependency(depKey: string): { found: boolean; dep: Dependency } {
  const dep = DEPENDENCIES[depKey];
  if (!dep) {
    return { found: true, dep: { name: depKey, commands: [], macInstall: "", linuxInstall: "" } };
  }

  const found = dep.commands.some((cmd) => commandExists(cmd));
  return { found, dep };
}

export function checkDependencies(converterType: string): void {
  const requiredDeps = CONVERTER_DEPENDENCIES[converterType];
  if (!requiredDeps || requiredDeps.length === 0) {
    return;
  }

  const missingDeps: Dependency[] = [];

  for (const depKey of requiredDeps) {
    const { found, dep } = checkDependency(depKey);
    if (!found) {
      missingDeps.push(dep);
    }
  }

  if (missingDeps.length > 0) {
    const platform = os.platform();
    const isMac = platform === "darwin";

    console.error("\n✗ Missing required dependencies:\n");

    for (const dep of missingDeps) {
      console.error(`  • ${dep.name}`);
    }

    console.error("\nInstallation instructions:");

    if (isMac) {
      console.error("\n  macOS (using Homebrew):");
      for (const dep of missingDeps) {
        console.error(`    ${dep.macInstall}`);
      }
    } else {
      console.error("\n  Linux (Ubuntu/Debian):");
      for (const dep of missingDeps) {
        console.error(`    ${dep.linuxInstall}`);
      }
    }

    console.error("");
    process.exit(1);
  }
}

import * as fs from "fs";
import * as path from "path";

export interface BundleInfo {
  name: string;
  path: string;
}

// Find bundle directories in output/
export function findBundles(outputDir: string): BundleInfo[] {
  const bundles: BundleInfo[] = [];

  if (!fs.existsSync(outputDir)) {
    return bundles;
  }

  const entries = fs.readdirSync(outputDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Check for mulmo_view.json in subdirectories (e.g., output/GraphAI/mulmo_script/)
      const dirPath = path.join(outputDir, entry.name);
      const subEntries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isDirectory()) {
          const subDirPath = path.join(dirPath, subEntry.name);
          if (fs.existsSync(path.join(subDirPath, "mulmo_view.json"))) {
            bundles.push({
              name: entry.name,
              path: `${entry.name}/${subEntry.name}`,
            });
          }
        }
      }
    }
  }

  return bundles;
}

// MIME type mapping
const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// Get MIME type from file extension
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

// Check if file exists and is a file (not directory)
export function isValidFile(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

// Create read stream for file
export function createFileStream(filePath: string): fs.ReadStream {
  return fs.createReadStream(filePath);
}

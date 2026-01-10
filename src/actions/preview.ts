#!/usr/bin/env tsx

import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_PORT = 3000;

interface BundleInfo {
  name: string;
  path: string;
}

// Find bundle directories in scripts/
function findBundles(scriptsDir: string): BundleInfo[] {
  const bundles: BundleInfo[] = [];

  if (!fs.existsSync(scriptsDir)) {
    return bundles;
  }

  const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const dirPath = path.join(scriptsDir, entry.name);

      // Check direct path
      if (fs.existsSync(path.join(dirPath, "mulmo_view.json"))) {
        bundles.push({ name: entry.name, path: entry.name });
        continue;
      }

      // Check subdirectories
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

// Get MIME type from file extension
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
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
  return mimeTypes[ext] || "application/octet-stream";
}

// Serve static file
function serveFile(res: http.ServerResponse, filePath: string): void {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  res.writeHead(200, { "Content-Type": getMimeType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

export function startPreviewServer(port: number = DEFAULT_PORT): void {
  const cwd = process.cwd();
  const scriptsDir = path.join(cwd, "scripts");

  // Find the Vue build directory
  // In development, it's in the project root
  // In npm package, it's in node_modules/@mulmocast/slide/lib/vue
  let vueDir = path.join(__dirname, "..", "..", "lib", "vue");
  if (!fs.existsSync(vueDir)) {
    // Fallback to project root for development
    vueDir = path.join(__dirname, "..", "..", "..", "lib", "vue");
  }

  if (!fs.existsSync(vueDir)) {
    console.error("Vue build not found. Run 'yarn build:vue' first.");
    console.log("Or use 'yarn dev' for development mode.");
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = url.pathname;

    // API endpoint for bundles list
    if (pathname === "/api/bundles") {
      const bundles = findBundles(scriptsDir);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(bundles));
      return;
    }

    // Serve bundle files from scripts/
    if (pathname.startsWith("/bundles/")) {
      const bundlePath = pathname.slice("/bundles/".length);
      const filePath = path.join(scriptsDir, bundlePath);
      serveFile(res, filePath);
      return;
    }

    // Serve Vue app static files
    let filePath = path.join(vueDir, pathname);
    if (pathname === "/" || !fs.existsSync(filePath)) {
      filePath = path.join(vueDir, "index.html");
    }
    serveFile(res, filePath);
  });

  server.listen(port, () => {
    console.log(`\nMulmoViewer Preview Server`);
    console.log(`  Local: http://localhost:${port}`);
    console.log(`  Scripts directory: ${scriptsDir}`);
    console.log(`\nPress Ctrl+C to stop\n`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const port = args[0] ? parseInt(args[0], 10) : DEFAULT_PORT;

  if (isNaN(port)) {
    console.error("Invalid port number");
    process.exit(1);
  }

  startPreviewServer(port);
}

// Only run main() when executed directly
const isDirectRun =
  process.argv[1]?.endsWith("preview.ts") || process.argv[1]?.endsWith("preview.js");
if (isDirectRun) {
  main();
}

#!/usr/bin/env tsx

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { saveAudio, transcribeAudio, parseRequestBody } from "../utils/audio-save";

// Load .env file
dotenv.config();

const DEFAULT_PORT = 3000;

interface BundleInfo {
  name: string;
  path: string;
}

// Find bundle directories in output/
function findBundles(outputDir: string): BundleInfo[] {
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
  const outputDir = path.join(cwd, "output");

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

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = url.pathname;

    // API endpoint for bundles list
    if (pathname === "/api/bundles") {
      const bundles = findBundles(outputDir);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(bundles));
      return;
    }

    // API endpoint for saving recorded audio
    if (pathname === "/api/save-audio" && req.method === "POST") {
      const body = await parseRequestBody(req);
      if (!body) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid request body" }));
        return;
      }
      const result = saveAudio(outputDir, body);
      res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    // API endpoint for transcribing audio
    if (pathname === "/api/transcribe" && req.method === "POST") {
      const body = await parseRequestBody(req);
      if (!body) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid request body" }));
        return;
      }
      const result = await transcribeAudio(body);
      res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    // Serve bundle files from output/
    if (pathname.startsWith("/bundles/")) {
      const bundlePath = pathname.slice("/bundles/".length);
      const filePath = path.join(outputDir, bundlePath);
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
    console.log(`  Output directory: ${outputDir}`);
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

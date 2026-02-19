#!/usr/bin/env tsx

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  saveBeatText,
  transcribeAudio,
  parseRequestBody,
  type SaveBeatTextRequest,
  type TranscribeRequest,
} from "../utils/audio-save.js";
import { findBundles, getMimeType, isValidFile, createFileStream } from "../utils/bundle-server.js";
import { handleChatRequest } from "../utils/chat-api.js";

// Load .env file
dotenv.config({ quiet: true });

const DEFAULT_PORT = 3000;

// Serve static file with Range request support (required by Safari for audio/video)
function serveFile(req: http.IncomingMessage, res: http.ServerResponse, filePath: string): void {
  if (!isValidFile(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const mimeType = getMimeType(filePath);
  const range = req.headers.range;

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
      res.end();
      return;
    }
    const start = parseInt(match[1], 10);
    const rawEnd = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize || start > rawEnd) {
      res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
      res.end();
      return;
    }

    // Clamp end to fileSize - 1 per RFC 7233 Section 2.1
    const end = Math.min(rawEnd, fileSize - 1);

    res.writeHead(206, {
      "Content-Type": mimeType,
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
      "Content-Length": fileSize,
    });
    createFileStream(filePath).pipe(res);
  }
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
    const pathname = decodeURIComponent(url.pathname);

    // API endpoint for bundles list
    if (pathname === "/api/bundles") {
      const bundles = findBundles(outputDir);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(bundles));
      return;
    }

    // API endpoint for saving recorded audio
    if (pathname === "/api/save-beat-text" && req.method === "POST") {
      const body = await parseRequestBody<SaveBeatTextRequest>(req);
      if (!body) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid request body" }));
        return;
      }
      const result = saveBeatText(outputDir, body);
      res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    // API endpoint for chat completion
    if (pathname === "/api/chat" && req.method === "POST") {
      await handleChatRequest(req, res);
      return;
    }

    // API endpoint for transcribing audio
    if (pathname === "/api/transcribe" && req.method === "POST") {
      const body = await parseRequestBody<TranscribeRequest>(req);
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
      serveFile(req, res, filePath);
      return;
    }

    // Serve Vue app static files
    let filePath = path.join(vueDir, pathname);
    if (pathname === "/" || !fs.existsSync(filePath)) {
      filePath = path.join(vueDir, "index.html");
    }
    serveFile(req, res, filePath);
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

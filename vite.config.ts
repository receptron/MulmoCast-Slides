import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { saveBeatText, transcribeAudio, parseRequestBody } from "./src/utils/audio-save";
import { findBundles, getMimeType, isValidFile, createFileStream } from "./src/utils/bundle-server";
import { handleChatRequest } from "./src/utils/chat-api";

// Load .env file
dotenv.config();

// Plugin to serve bundle files
function bundleServerPlugin() {
  return {
    name: "bundle-server",
    configureServer(server: any) {
      const cwd = process.cwd();
      const outputDir = path.join(cwd, "output");

      server.middlewares.use("/api/bundles", (_req: any, res: any) => {
        const bundles = findBundles(outputDir);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(bundles));
      });

      // Save recorded audio
      server.middlewares.use("/api/save-audio", async (req: any, res: any, next: any) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        const body = await parseRequestBody(req);
        if (!body) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: "Invalid request body" }));
          return;
        }
        const result = saveAudio(outputDir, body);
        res.setHeader("Content-Type", "application/json");
        res.statusCode = result.success ? 200 : 400;
        res.end(JSON.stringify(result));
      });

      // Chat completion via OpenAI API (server-side, keeps API key secure)
      server.middlewares.use("/api/chat", async (req: any, res: any, next: any) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        await handleChatRequest(req, res);
      });

      // Transcribe audio using Whisper API
      server.middlewares.use("/api/transcribe", async (req: any, res: any, next: any) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        const body = await parseRequestBody(req);
        if (!body) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: "Invalid request body" }));
          return;
        }
        const result = await transcribeAudio(body);
        res.setHeader("Content-Type", "application/json");
        res.statusCode = result.success ? 200 : 400;
        res.end(JSON.stringify(result));
      });

      // Serve bundle files from output/
      server.middlewares.use("/bundles", (req: any, res: any, next: any) => {
        let urlPath: string;
        try {
          urlPath = decodeURIComponent(req.url?.split("?")[0] || "");
        } catch {
          res.statusCode = 400;
          res.end("Bad Request");
          return;
        }
        // Strip /bundles prefix if present (depends on how Vite routes the request)
        if (urlPath.startsWith("/bundles/")) {
          urlPath = urlPath.slice("/bundles".length);
        }
        const filePath = path.normalize(path.join(outputDir, urlPath));
        if (!filePath.startsWith(outputDir + path.sep) && filePath !== outputDir) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        if (isValidFile(filePath)) {
          const stat = fs.statSync(filePath);
          const fileSize = stat.size;
          const mimeType = getMimeType(filePath);
          const range = req.headers.range;

          if (range) {
            const match = range.match(/bytes=(\d+)-(\d*)/);
            if (!match) {
              res.statusCode = 416;
              res.setHeader("Content-Range", `bytes */${fileSize}`);
              res.end();
              return;
            }
            const start = parseInt(match[1], 10);
            const rawEnd = match[2] ? parseInt(match[2], 10) : fileSize - 1;
            if (start >= fileSize || start > rawEnd) {
              res.statusCode = 416;
              res.setHeader("Content-Range", `bytes */${fileSize}`);
              res.end();
              return;
            }
            const end = Math.min(rawEnd, fileSize - 1);
            res.statusCode = 206;
            res.setHeader("Content-Type", mimeType);
            res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Content-Length", String(end - start + 1));
            fs.createReadStream(filePath, { start, end }).pipe(res);
          } else {
            res.setHeader("Content-Type", mimeType);
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Content-Length", String(fileSize));
            createFileStream(filePath).pipe(res);
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), bundleServerPlugin()],
  root: "src/vue",
  base: "./",
  build: {
    outDir: "../../lib/vue",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});

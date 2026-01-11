import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import * as path from "path";
import * as fs from "fs";
import dotenv from "dotenv";
import { saveAudio, transcribeAudio, parseRequestBody } from "./src/utils/audio-save";

// Load .env file
dotenv.config();

// Find bundle directories in output/
function findBundles(outputDir: string): { name: string; path: string }[] {
  const bundles: { name: string; path: string }[] = [];

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
        let urlPath = req.url?.split("?")[0] || "";
        // Strip /bundles prefix if present (depends on how Vite routes the request)
        if (urlPath.startsWith("/bundles/")) {
          urlPath = urlPath.slice("/bundles".length);
        }
        const filePath = path.join(outputDir, urlPath);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".mp3": "audio/mpeg",
            ".mp4": "video/mp4",
          };
          res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
          fs.createReadStream(filePath).pipe(res);
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

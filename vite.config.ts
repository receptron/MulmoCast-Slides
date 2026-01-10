import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import * as path from "path";
import * as fs from "fs";

// Find bundle directories in scripts/
function findBundles(scriptsDir: string): { name: string; path: string }[] {
  const bundles: { name: string; path: string }[] = [];

  if (!fs.existsSync(scriptsDir)) {
    return bundles;
  }

  const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Check for mulmo_view.json in the directory or its subdirectories
      const dirPath = path.join(scriptsDir, entry.name);

      // Check direct path
      if (fs.existsSync(path.join(dirPath, "mulmo_view.json"))) {
        bundles.push({ name: entry.name, path: entry.name });
        continue;
      }

      // Check subdirectories (e.g., scripts/GraphAI/mulmo_script/)
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
      const scriptsDir = path.join(cwd, "scripts");

      server.middlewares.use("/api/bundles", (_req: any, res: any) => {
        const bundles = findBundles(scriptsDir);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(bundles));
      });

      // Serve bundle files from scripts/
      server.middlewares.use("/bundles", (req: any, res: any, next: any) => {
        const urlPath = req.url?.split("?")[0] || "";
        const filePath = path.join(scriptsDir, urlPath);

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
  plugins: [vue(), bundleServerPlugin()],
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

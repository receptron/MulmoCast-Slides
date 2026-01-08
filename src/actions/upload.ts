#!/usr/bin/env tsx

import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ quiet: true });

const API_BASE_URL = "https://mulmocast-app-dev.web.app/api/1.0";

interface SignData {
  fileName: string;
  key: string;
  contentType: string;
  url: string;
}

interface PostResponse {
  uploadPath: string;
  cloudBasePath: string;
  signs: SignData[];
}

async function uploadFileToR2(sign: SignData, mediaDir: string): Promise<boolean> {
  const filePath = path.join(mediaDir, sign.fileName);

  if (!fs.existsSync(filePath)) {
    console.error(`  Failed to upload: ${sign.fileName} not found`);
    return false;
  }

  const fileBuffer = fs.readFileSync(filePath);

  try {
    const response = await fetch(sign.url, {
      method: "PUT",
      headers: {
        "Content-Type": sign.contentType,
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!response.ok) {
      console.error(
        `  Failed to upload ${sign.fileName}: ${response.status} ${response.statusText}`
      );
      return false;
    }

    console.log(`  Uploaded: ${sign.fileName}`);
    return true;
  } catch (error) {
    console.error(`  Error uploading ${sign.fileName}:`, error);
    return false;
  }
}

async function uploadBundleDir(
  bundleDir: string,
  apiKey: string
): Promise<{ success: boolean; uploadPath?: string }> {
  const jsonFilePath = path.join(bundleDir, "mulmo_view.json");
  if (!fs.existsSync(jsonFilePath)) {
    throw new Error(`mulmo_view.json not found in ${bundleDir}`);
  }

  const fileContent = fs.readFileSync(jsonFilePath, "utf-8");
  const viewer = JSON.parse(fileContent);

  console.log("  Requesting upload URLs...");
  const response = await fetch(`${API_BASE_URL}/me/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ viewer }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server error: ${response.status} ${errorText}`);
  }

  const data: PostResponse = await response.json();

  if (data.signs && data.signs.length > 0) {
    console.log(`  Uploading ${data.signs.length} files...`);
    let failCount = 0;

    for (const sign of data.signs) {
      const success = await uploadFileToR2(sign, bundleDir);
      if (!success) {
        failCount++;
      }
    }

    if (failCount > 0) {
      throw new Error(`Failed to upload ${failCount} out of ${data.signs.length} files`);
    }
  }

  const contentId = data.uploadPath.split("/").pop();
  if (!contentId) {
    throw new Error("Failed to extract contentId from uploadPath");
  }

  console.log("  Completing upload...");
  const completeResponse = await fetch(`${API_BASE_URL}/me/uploads/${contentId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ contentId }),
  });

  if (!completeResponse.ok) {
    const errorText = await completeResponse.text();
    throw new Error(`Failed to complete upload: ${completeResponse.status} ${errorText}`);
  }

  return {
    success: true,
    uploadPath: data.uploadPath,
  };
}

function findBundleDir(basename: string): string {
  const outputDir = path.join("output", basename);

  if (!fs.existsSync(outputDir)) {
    throw new Error(`Output directory not found: ${outputDir}`);
  }

  // Search for subdirectory containing mulmo_view.json
  const entries = fs.readdirSync(outputDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const candidatePath = path.join(outputDir, entry.name);
      if (fs.existsSync(path.join(candidatePath, "mulmo_view.json"))) {
        return candidatePath;
      }
    }
  }

  throw new Error(`mulmo_view.json not found in ${outputDir}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: yarn upload <basename>");
    console.error("");
    console.error("Upload a bundle to MulmoCast server.");
    console.error("The bundle is expected at output/<basename>/<script>/");
    console.error("");
    console.error("Environment variable required:");
    console.error("  MULMO_MEDIA_API_KEY - API key for authentication");
    process.exit(1);
  }

  let bundleDir: string;
  try {
    bundleDir = findBundleDir(args[0]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const apiKey = process.env.MULMO_MEDIA_API_KEY;
  if (!apiKey) {
    console.error("Error: MULMO_MEDIA_API_KEY environment variable is not set");
    process.exit(1);
  }

  try {
    console.log(`\nUploading bundle...`);
    console.log(`  Directory: ${bundleDir}`);

    const result = await uploadBundleDir(bundleDir, apiKey);

    console.log(`\n✓ Upload complete!`);
    console.log(`  Upload path: ${result.uploadPath}`);
  } catch (error) {
    console.error("\n✗ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

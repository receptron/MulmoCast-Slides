#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer';

// Type Definitions
interface MulmoScript {
  $mulmocast: {
    version: string;
    credit: string;
  };
  beats: Beat[];
}

interface Beat {
  text: string;
  image: ImagePath | ImageHTML;
}

interface ImagePath {
  type: 'image';
  source: {
    kind: 'path';
    path: string;
  };
}

interface ImageHTML {
  type: 'html_tailwind';
  html: string[];
}

// Parse command-line arguments
function parseArguments(): string {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('Error: No input file specified');
    console.error('Usage: yarn marp <path-to-marp-file.md>');
    process.exit(1);
  }

  const absolutePath = path.resolve(inputPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found: ${absolutePath}`);
    process.exit(1);
  }

  if (!absolutePath.endsWith('.md')) {
    console.error('Error: Input file must be a .md (Markdown) file');
    process.exit(1);
  }

  return absolutePath;
}

// Setup output directories
function setupOutputDirectories(): void {
  const outputFolder = path.join(process.cwd(), 'output');
  const outputImagesFolder = path.join(outputFolder, 'images');

  // Create directories if they don't exist
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  if (!fs.existsSync(outputImagesFolder)) {
    fs.mkdirSync(outputImagesFolder, { recursive: true });
  }

  // Clean existing PNG files
  const files = fs.readdirSync(outputImagesFolder);
  for (const file of files) {
    if (file.endsWith('.png')) {
      fs.unlinkSync(path.join(outputImagesFolder, file));
    }
  }
}

// Extract speaker notes from markdown
function extractSpeakerNotes(markdownPath: string): string[] {
  const content = fs.readFileSync(markdownPath, 'utf-8');

  // Split by slide separator
  const slides = content.split(/\n---\n/);

  const notes: string[] = [];

  for (const slide of slides) {
    const slideNotes = extractNotesFromSlide(slide);
    notes.push(slideNotes);
  }

  return notes;
}

// Extract notes from a single slide
function extractNotesFromSlide(slideContent: string): string {
  const commentRegex = /<!--\s*([\s\S]*?)\s*-->/g;
  const matches: string[] = [];
  let match;

  while ((match = commentRegex.exec(slideContent)) !== null) {
    matches.push(match[1].trim());
  }

  // Join multiple comments with newlines
  return matches.join('\n');
}

// Render slides to HTML and images using Marp CLI
function renderSlidesToHTML(markdownPath: string): { htmlPath: string; slideCount: number } {
  const outputFolder = path.join(process.cwd(), 'output');
  const tempFolder = path.join(outputFolder, '.temp');
  const imagesFolder = path.join(outputFolder, 'images');

  // Create temp directory
  if (!fs.existsSync(tempFolder)) {
    fs.mkdirSync(tempFolder, { recursive: true });
  }

  const htmlPath = path.join(tempFolder, 'presentation.html');

  // Execute Marp CLI to generate HTML (for HTML extraction)
  try {
    execSync(`npx @marp-team/marp-cli "${markdownPath}" -o "${htmlPath}" --html`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Error: Failed to render Marp presentation to HTML');
    console.error('Make sure @marp-team/marp-cli is installed');
    process.exit(1);
  }

  // Execute Marp CLI to generate PNG images directly
  try {
    execSync(`npx @marp-team/marp-cli "${markdownPath}" -o "${imagesFolder}/slide.png" --images png`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Error: Failed to render Marp presentation to images');
    console.error('Make sure @marp-team/marp-cli is installed');
    process.exit(1);
  }

  // Count slides from HTML
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const slideCount = (html.match(/<section/g) || []).length;

  // Rename generated images to match expected format (images.001.png, etc.)
  renameGeneratedImages(imagesFolder, slideCount);

  return { htmlPath, slideCount };
}

// Rename Marp-generated images to expected format
function renameGeneratedImages(imagesFolder: string, slideCount: number): void {
  for (let i = 1; i <= slideCount; i++) {
    const marpFilename = `slide.${String(i).padStart(3, '0')}.png`;
    const expectedFilename = `images.${String(i).padStart(3, '0')}.png`;
    const marpPath = path.join(imagesFolder, marpFilename);
    const expectedPath = path.join(imagesFolder, expectedFilename);

    if (fs.existsSync(marpPath)) {
      fs.renameSync(marpPath, expectedPath);
    }
  }
}

// Extract HTML content from each slide
function extractSlideHTML(htmlPath: string): string[][] {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const slides: string[][] = [];

  // Marp wraps each slide in <section> tags
  const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/g;
  let match;

  while ((match = sectionRegex.exec(html)) !== null) {
    const slideHTML = match[1].trim();
    // Split into array of lines, removing empty lines
    const lines = slideHTML.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    slides.push(lines);
  }

  return slides;
}

// Note: Screenshots are now generated directly by Marp CLI in renderSlidesToHTML()
// This function is kept for compatibility but does nothing
async function captureScreenshots(htmlPath: string, slideCount: number): Promise<void> {
  // Images are already generated by Marp CLI
  return;
}

// Generate MulmoScript JSON with image paths
function generateMulmoScriptImage(notes: string[], slideCount: number): void {
  const outputFolder = path.join(process.cwd(), 'output');
  const imagesFolder = path.join(outputFolder, 'images');

  // Align notes array length with slide count
  while (notes.length < slideCount) {
    notes.push('');
  }

  const beats: Beat[] = notes.slice(0, slideCount).map((note, index) => {
    const slideNum = String(index + 1).padStart(3, '0');
    const imagePath = path.join(imagesFolder, `images.${slideNum}.png`);

    return {
      text: note || '',
      image: {
        type: 'image',
        source: {
          kind: 'path',
          path: imagePath
        }
      }
    };
  });

  const mulmocast: MulmoScript = {
    $mulmocast: {
      version: '1.0',
      credit: 'closing'
    },
    beats
  };

  const scriptPath = path.join(outputFolder, 'script.json');
  fs.writeFileSync(scriptPath, JSON.stringify(mulmocast, null, 2), 'utf-8');
}

// Generate MulmoScript JSON with HTML
function generateMulmoScriptHTML(notes: string[], slideHTMLs: string[][]): void {
  const outputFolder = path.join(process.cwd(), 'output');

  // Align notes array length with slide count
  while (notes.length < slideHTMLs.length) {
    notes.push('');
  }

  const beats: Beat[] = slideHTMLs.map((html, index) => {
    return {
      text: notes[index] || '',
      image: {
        type: 'html_tailwind',
        html
      }
    };
  });

  const mulmocast: MulmoScript = {
    $mulmocast: {
      version: '1.0',
      credit: 'closing'
    },
    beats
  };

  const scriptPath = path.join(outputFolder, 'script-html.json');
  fs.writeFileSync(scriptPath, JSON.stringify(mulmocast, null, 2), 'utf-8');
}

// Cleanup temporary files
function cleanupTempFiles(): void {
  const outputFolder = path.join(process.cwd(), 'output');
  const tempFolder = path.join(outputFolder, '.temp');

  if (fs.existsSync(tempFolder)) {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

// Main function
async function main() {
  try {
    console.log('Starting Marp to MulmoScript conversion...\n');

    // Parse arguments
    const inputPath = parseArguments();
    console.log(`Input file: ${inputPath}`);

    // Setup output directories
    setupOutputDirectories();
    console.log('Output directories prepared');

    // Extract speaker notes
    const notes = extractSpeakerNotes(inputPath);
    console.log(`Extracted ${notes.length} speaker notes`);

    // Render to HTML
    console.log('Rendering slides to HTML...');
    const { htmlPath, slideCount } = renderSlidesToHTML(inputPath);
    console.log(`Rendered ${slideCount} slides`);

    // Extract HTML for html_tailwind format
    console.log('Extracting slide HTML...');
    const slideHTMLs = extractSlideHTML(htmlPath);
    console.log(`Extracted ${slideCount} slide HTMLs`);

    // Generate both MulmoScript formats
    console.log('Generating MulmoScript JSON files...');
    generateMulmoScriptImage(notes, slideCount);
    console.log('✓ Created output/script.json (PNG format)');

    generateMulmoScriptHTML(notes, slideHTMLs);
    console.log('✓ Created output/script-html.json (HTML format)');

    // Cleanup
    cleanupTempFiles();

    console.log(`\n✓ Successfully generated MulmoScript with ${slideCount} slides`);
  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute
main();

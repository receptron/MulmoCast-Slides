# MulmoViewer Preview

MulmoViewer Preview is a Vue-based web application for previewing MulmoCast bundles locally.

## Usage

### Development Mode

```bash
yarn dev
```

Starts the Vite development server with hot reload on port 3000.

### Production Preview

```bash
yarn preview
# or
yarn run cli preview
# or with custom port
yarn run cli preview 8080
```

Starts a production preview server using the built Vue application.

### Building

```bash
yarn build:vue
```

Builds the Vue application to `lib/vue/` for npm package distribution.

## Features

- Bundle selection from header navigation
- Audio language switching (EN/JA)
- Text language switching (EN/JA)
- Slide navigation with Prev/Next buttons
- Audio playback with auto-advance
- **Audio Recording Mode** - Record narration for each beat

## Audio Recording Mode (録音モード)

The preview application includes a built-in audio recording feature that allows you to:

1. Record audio narration for each beat/slide
2. Automatically transcribe recordings using OpenAI Whisper API
3. Edit transcribed text before saving
4. Update `mulmo_view.json` and `mulmo_script.json` with new audio and text

### Prerequisites

- `OPENAI_API_KEY` environment variable must be set in `.env` file
- Microphone access permission in your browser

### Recording Workflow

1. **Start Recording Mode**: Click "Record Audio" button in the header
2. **Record**: Click "Record" to start recording for the current beat
3. **Stop**: Click "Stop" when finished speaking
4. **Transcription**: Audio is automatically transcribed and appended to existing text
5. **Edit**: Modify the transcribed text in the text editor if needed
6. **Navigate**: Use "Prev"/"Next" to move between beats
7. **Save**: Click "Save All" to save all recorded audio and edited text
8. **Discard**: Click "Discard" to cancel and exit recording mode

### How It Works

- Recording uses the browser's MediaRecorder API (WebM format)
- Transcription uses OpenAI Whisper API
- **Text is appended**: Each new recording's transcription is appended to existing text (not replaced)
- **Original language**: Audio and text are saved to the script's original language (e.g., `ja` for Japanese scripts)
- Saved files:
  - Audio: `output/{bundle}/{beatIndex+1}_{lang}.mp3`
  - Updated: `mulmo_view.json` (audioSources, multiLinguals)
  - Updated: `scripts/{basename}/mulmo_script.json` (beats[].text)

## Directory Structure

```
src/vue/
  App.vue         # Main application component
  main.ts         # Vue app entry point
  style.css       # Tailwind CSS import
  index.html      # HTML template

src/utils/
  audio-save.ts   # Audio saving and transcription utilities

lib/vue/          # Built output (for npm distribution)
```

## Technical Details

### Stack

- **Vue 3** - Composition API with `<script setup>`
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Utility-first CSS framework
- **mulmocast-viewer** - MulmoViewer component package
- **OpenAI API** - Whisper for transcription

### Bundle Discovery

The application looks for bundles in the `output/` directory. A valid bundle directory must contain a `mulmo_view.json` file.

Expected structure:
```
output/
  {project-name}/
    {script-type}/
      mulmo_view.json    # Bundle manifest
      *.png              # Slide images
      *.mp3              # Audio files
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bundles` | GET | Returns list of available bundles |
| `/bundles/{path}/*` | GET | Serves bundle files (images, audio, JSON) |
| `/api/save-audio` | POST | Save recorded audio and update JSON files |
| `/api/transcribe` | POST | Transcribe audio using Whisper API |

### Save Audio Request

```typescript
interface SaveAudioRequest {
  bundlePath: string;    // e.g., "GraphAI/mulmo_script"
  beatIndex: number;     // 0-based index
  langKey: string;       // e.g., "ja", "en"
  audioBase64: string;   // base64 encoded audio
  text?: string;         // transcribed/edited text
}
```

### Transcribe Request

```typescript
interface TranscribeRequest {
  audioBase64: string;   // base64 encoded audio (WebM)
  lang?: string;         // language hint for Whisper
}
```

### Vite Configuration

The `vite.config.ts` includes a custom plugin (`bundleServerPlugin`) that:

1. Serves `/api/bundles` endpoint returning discovered bundles
2. Serves bundle files from `output/` directory via `/bundles/` path
3. Handles `/api/save-audio` for saving recorded audio
4. Handles `/api/transcribe` for speech-to-text conversion
5. Handles MIME types for JSON, PNG, JPG, MP3, MP4 files

### MulmoViewer Props

| Prop | Type | Description |
|------|------|-------------|
| `data-set` | `ViewerData` | Bundle data from mulmo_view.json |
| `base-path` | `string` | Base URL path for media files |
| `init-page` | `number` | Initial slide page |
| `audio-lang` | `string` | Audio language (v-model) |
| `text-lang` | `string` | Text language (v-model) |
| `auto-play` | `boolean` | Auto-play audio (disabled in recording mode) |

### ViewerData Interface

```typescript
interface ViewerData {
  beats: BundleItem[];
  bgmSource?: string;
  bgmFile?: string;
  lang?: string;
}

interface BundleItem {
  text?: string;
  multiLinguals?: Record<string, string>;
  audioSources?: Record<string, string>;
  imageSource?: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
}
```

## Customization

### Overriding Styles

The application uses Tailwind CSS. To override mulmocast-viewer styles, add custom CSS in the `<style>` section of `App.vue`:

```css
<style>
/* Override mulmocast-viewer text styles */
.text-gray-800 {
  color: #fff !important;
}
</style>
```

### Adding Languages

To add more language options, update the `availableLangs` computed property or extend the language detection logic based on available `audioSources` in the bundle data.

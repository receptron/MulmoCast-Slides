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

## Directory Structure

```
src/vue/
  App.vue         # Main application component
  main.ts         # Vue app entry point
  style.css       # Tailwind CSS import
  index.html      # HTML template

lib/vue/          # Built output (for npm distribution)
```

## Technical Details

### Stack

- **Vue 3** - Composition API with `<script setup>`
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Utility-first CSS framework
- **mulmocast-viewer** - MulmoViewer component package

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

| Endpoint | Description |
|----------|-------------|
| `GET /api/bundles` | Returns list of available bundles |
| `GET /bundles/{path}/*` | Serves bundle files (images, audio, JSON) |

### Vite Configuration

The `vite.config.ts` includes a custom plugin (`bundleServerPlugin`) that:

1. Serves `/api/bundles` endpoint returning discovered bundles
2. Serves bundle files from `output/` directory via `/bundles/` path
3. Handles MIME types for JSON, PNG, JPG, MP3, MP4 files

### MulmoViewer Props

| Prop | Type | Description |
|------|------|-------------|
| `data-set` | `ViewerData` | Bundle data from mulmo_view.json |
| `base-path` | `string` | Base URL path for media files |
| `init-page` | `number` | Initial slide page |
| `audio-lang` | `string` | Audio language (v-model) |
| `text-lang` | `string` | Text language (v-model) |

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

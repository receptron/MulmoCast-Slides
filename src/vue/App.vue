<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { MulmoViewer } from "mulmocast-viewer";
import "mulmocast-viewer/style.css";

interface BundleInfo {
  name: string;
  path: string;
}

interface ViewerData {
  beats: any[];
  bgmSource?: string;
  bgmFile?: string;
  lang?: string;
}

const bundles = ref<BundleInfo[]>([]);
const selectedBundle = ref<string | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const viewData = ref<ViewerData | null>(null);
const currentPage = ref(0);
const audioLang = ref("en");
const textLang = ref("en");

// Edit mode state
const recordingMode = ref(false);
const isRecording = ref(false);
const isTranscribing = ref(false);
const mediaRecorder = ref<MediaRecorder | null>(null);
const audioChunks = ref<Blob[]>([]);
const recordedAudios = ref<Map<number, Blob>>(new Map());
const editedTexts = ref<Map<number, string>>(new Map());
const savingAudio = ref(false);
const recordingError = ref<string | null>(null);

// Script's original language (detect from viewData.lang or audioSources keys)
const scriptLang = computed(() => {
  if (viewData.value?.lang) {
    return viewData.value.lang;
  }
  // Fallback: detect from audioSources keys
  // Prefer non-English language as it's likely the original
  const audioSources = viewData.value?.beats?.[0]?.audioSources;
  if (audioSources) {
    const langs = Object.keys(audioSources);
    // If "ja" exists, it's likely the original for Japanese content
    if (langs.includes("ja")) return "ja";
    // Otherwise return first non-"en" language, or "en" as last resort
    return langs.find((l) => l !== "en") || langs[0] || "en";
  }
  return "en";
});

// Current beat's editable text (initialized from existing text)
const currentEditText = computed({
  get: () => {
    // If we have edited text, use it
    if (editedTexts.value.has(currentPage.value)) {
      return editedTexts.value.get(currentPage.value) || "";
    }
    // Otherwise, use existing text from viewData
    const beat = viewData.value?.beats?.[currentPage.value];
    if (beat) {
      return beat.multiLinguals?.[scriptLang.value] || beat.text || "";
    }
    return "";
  },
  set: (val: string) => {
    editedTexts.value.set(currentPage.value, val);
  },
});

const availableAudioLangs = computed(() => {
  if (!viewData.value?.beats?.[0]?.audioSources) return ["en"];
  return Object.keys(viewData.value.beats[0].audioSources);
});

const availableTextLangs = computed(() => {
  if (!viewData.value?.beats?.[0]?.multiLinguals) return ["en"];
  return Object.keys(viewData.value.beats[0].multiLinguals);
});

const basePath = computed(() => {
  if (!selectedBundle.value) return "";
  return `/bundles/${selectedBundle.value}`;
});

onMounted(async () => {
  try {
    const response = await fetch("/api/bundles");
    if (!response.ok) {
      throw new Error("Failed to load bundles");
    }
    bundles.value = await response.json();
    if (bundles.value.length > 0) {
      selectedBundle.value = bundles.value[0].path;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unknown error";
  } finally {
    loading.value = false;
  }
});

watch(selectedBundle, async (newPath) => {
  if (!newPath) {
    viewData.value = null;
    return;
  }
  try {
    const response = await fetch(`/bundles/${newPath}/mulmo_view.json`);
    if (!response.ok) {
      throw new Error("Failed to load bundle data");
    }
    viewData.value = await response.json();
    currentPage.value = 0;

    // Reset language selects to valid values for this bundle
    const audioLangs = viewData.value?.beats?.[0]?.audioSources
      ? Object.keys(viewData.value.beats[0].audioSources)
      : ["en"];
    const textLangs = viewData.value?.beats?.[0]?.multiLinguals
      ? Object.keys(viewData.value.beats[0].multiLinguals)
      : ["en"];
    if (!audioLangs.includes(audioLang.value)) {
      audioLang.value = audioLangs[0] || "en";
    }
    if (!textLangs.includes(textLang.value)) {
      textLang.value = textLangs[0] || "en";
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unknown error";
    viewData.value = null;
  }
});

function selectBundle(path: string) {
  selectedBundle.value = path;
}

function onUpdatedPage(page: number) {
  currentPage.value = page;
}

// Edit mode functions
const totalBeats = computed(() => viewData.value?.beats?.length || 0);

const recordedCount = computed(() => recordedAudios.value.size);

const editedCount = computed(() => editedTexts.value.size);

async function toggleRecordingMode() {
  if (recordingMode.value) {
    // Exit recording mode
    await stopRecording();
    recordingMode.value = false;
  } else {
    // Enter recording mode
    recordingError.value = null;
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop()); // Release immediately, we'll request again when recording
      recordingMode.value = true;
      // Keep current page position instead of resetting to 0
      recordedAudios.value = new Map();
      editedTexts.value = new Map();
    } catch (e) {
      recordingError.value = e instanceof Error ? e.message : "Failed to access microphone";
    }
  }
}

async function startRecording() {
  if (isRecording.value) return;

  recordingError.value = null;
  audioChunks.value = [];

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(audioChunks.value, { type: "audio/webm" });
      recordedAudios.value.set(currentPage.value, blob);
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.value = recorder;
    recorder.start();
    isRecording.value = true;
  } catch (e) {
    recordingError.value = e instanceof Error ? e.message : "Failed to start recording";
  }
}

async function stopRecording() {
  if (!isRecording.value || !mediaRecorder.value) return;

  const beatIndex = currentPage.value;

  return new Promise<void>((resolve) => {
    if (mediaRecorder.value) {
      mediaRecorder.value.onstop = async () => {
        const blob = new Blob(audioChunks.value, { type: "audio/webm" });
        recordedAudios.value.set(beatIndex, blob);
        mediaRecorder.value?.stream.getTracks().forEach((track) => track.stop());
        isRecording.value = false;
        mediaRecorder.value = null;

        // Transcribe the audio
        await transcribeCurrentAudio(beatIndex, blob);
        resolve();
      };
      mediaRecorder.value.stop();
    } else {
      resolve();
    }
  });
}

async function transcribeCurrentAudio(beatIndex: number, blob: Blob) {
  isTranscribing.value = true;
  recordingError.value = null;

  try {
    const audioBase64 = await blobToBase64(blob);
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64,
        lang: scriptLang.value,
      }),
    });

    const result = await response.json();
    if (result.success && result.text) {
      // Append to existing text
      const existingText = currentEditText.value;
      const newText = existingText ? `${existingText}\n${result.text}` : result.text;
      editedTexts.value.set(beatIndex, newText);
    } else {
      recordingError.value = result.error || "Transcription failed";
    }
  } catch (e) {
    recordingError.value = e instanceof Error ? e.message : "Transcription failed";
  } finally {
    isTranscribing.value = false;
  }
}

async function nextBeatRecording() {
  await stopRecording();
  if (currentPage.value < totalBeats.value - 1) {
    currentPage.value++;
  }
}

async function prevBeatRecording() {
  await stopRecording();
  if (currentPage.value > 0) {
    currentPage.value--;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function saveAllRecordings() {
  if (!selectedBundle.value || (recordedAudios.value.size === 0 && editedTexts.value.size === 0))
    return;

  savingAudio.value = true;
  recordingError.value = null;

  try {
    const beatsToSave = new Set<number>();
    recordedAudios.value.forEach((_, beatIndex) => beatsToSave.add(beatIndex));
    editedTexts.value.forEach((_, beatIndex) => beatsToSave.add(beatIndex));

    for (const beatIndex of beatsToSave) {
      // Get edited text, or fall back to original
      const beat = viewData.value?.beats?.[beatIndex];
      const originalText = beat?.multiLinguals?.[scriptLang.value] || beat?.text || "";
      const text = editedTexts.value.get(beatIndex) ?? originalText;

      if (recordedAudios.value.has(beatIndex)) {
        const blob = recordedAudios.value.get(beatIndex)!;
        const audioBase64 = await blobToBase64(blob);

        const response = await fetch("/api/save-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bundlePath: selectedBundle.value,
            beatIndex,
            langKey: scriptLang.value,
            audioBase64,
            text,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || `Failed to save beat ${beatIndex + 1}`);
        }
      } else {
        const response = await fetch("/api/save-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bundlePath: selectedBundle.value,
            beatIndex,
            langKey: scriptLang.value,
            text,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || `Failed to save text for beat ${beatIndex + 1}`);
        }
      }
    }

    // Reload bundle data to get updated audioSources
    const response = await fetch(`/bundles/${selectedBundle.value}/mulmo_view.json`);
    if (response.ok) {
      viewData.value = await response.json();
    }

    // Exit recording mode
    recordingMode.value = false;
    recordedAudios.value = new Map();
    editedTexts.value = new Map();

    // Set language to script's language
    audioLang.value = scriptLang.value;
    textLang.value = scriptLang.value;
  } catch (e) {
    recordingError.value = e instanceof Error ? e.message : "Failed to save recordings";
  } finally {
    savingAudio.value = false;
  }
}

function discardRecordings() {
  recordedAudios.value = new Map();
  editedTexts.value = new Map();
  recordingMode.value = false;
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-900 text-white">
    <header class="bg-gray-800 border-b border-gray-700">
      <div class="flex items-center gap-6 px-6 py-3">
        <h1 class="text-lg font-semibold whitespace-nowrap">MulmoViewer Preview</h1>
        <nav v-if="bundles.length > 0" class="flex gap-2 flex-wrap">
          <button
            v-for="bundle in bundles"
            :key="bundle.path"
            class="px-3 py-1.5 rounded text-sm cursor-pointer transition-colors border-none"
            :class="
              selectedBundle === bundle.path
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            "
            @click="selectBundle(bundle.path)"
          >
            {{ bundle.name }}
          </button>
        </nav>
      </div>
      <div
        v-if="viewData"
        class="flex items-center gap-6 px-6 py-2 bg-gray-750 border-t border-gray-700"
      >
        <label class="flex items-center gap-2 text-sm text-gray-300">
          Audio:
          <select
            v-model="audioLang"
            class="bg-gray-700 border border-gray-600 text-white px-2 py-1 rounded text-sm cursor-pointer hover:bg-gray-600"
            :disabled="recordingMode"
          >
            <option v-for="lang in availableAudioLangs" :key="lang" :value="lang">
              {{ lang.toUpperCase() }}
            </option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-300">
          Text:
          <select
            v-model="textLang"
            class="bg-gray-700 border border-gray-600 text-white px-2 py-1 rounded text-sm cursor-pointer hover:bg-gray-600"
            :disabled="recordingMode"
          >
            <option v-for="lang in availableTextLangs" :key="lang" :value="lang">
              {{ lang.toUpperCase() }}
            </option>
          </select>
        </label>
        <div class="flex-1"></div>
        <button
          @click="toggleRecordingMode"
          class="px-3 py-1.5 rounded text-sm cursor-pointer transition-colors border-none"
          :class="
            recordingMode
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          "
        >
          {{ recordingMode ? "Exit Edit Mode" : "Edit Mode" }}
        </button>
      </div>
    </header>

    <main class="flex-1 flex items-center justify-content p-4">
      <div v-if="loading" class="text-center p-8 text-gray-400">Loading bundles...</div>
      <div v-else-if="error" class="text-center p-8 text-red-400">{{ error }}</div>
      <div v-else-if="bundles.length === 0" class="text-center p-8 text-gray-500">
        No bundles found in output/ directory.
        <p class="mt-2">
          Run
          <code class="bg-gray-800 px-2 py-1 rounded font-mono text-sm"
            >yarn run cli bundle &lt;file&gt;</code
          >
          to generate a bundle.
        </p>
      </div>
      <div v-else-if="viewData" class="w-full max-w-5xl mx-auto">
        <!-- Edit Mode UI -->
        <div v-if="recordingMode" class="mb-4 p-4 bg-gray-800 rounded-lg">
          <div class="flex items-center gap-4 mb-4">
            <span class="text-sm text-gray-300">
              Lang: <span class="text-white font-medium">{{ scriptLang.toUpperCase() }}</span>
            </span>
            <span class="text-sm text-gray-400">
              Beat {{ currentPage + 1 }} / {{ totalBeats }}
            </span>
            <span class="text-sm text-gray-400"> Edited: {{ editedCount }} </span>
          </div>

          <div v-if="recordingError" class="mb-4 p-2 bg-red-900 text-red-200 rounded text-sm">
            {{ recordingError }}
          </div>

          <div class="flex items-center gap-4 mb-4">
            <button
              @click="prevBeatRecording"
              :disabled="currentPage === 0 || isRecording || isTranscribing"
              class="px-4 py-2 rounded text-sm cursor-pointer transition-colors border-none disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 text-white hover:bg-gray-500"
            >
              Prev
            </button>

            <button
              v-if="!isRecording && !isTranscribing"
              @click="startRecording"
              class="w-56 px-6 py-2 rounded text-sm cursor-pointer transition-colors border-none bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2"
            >
              <span class="w-3 h-3 bg-white rounded-full"></span>
              Voice Input
            </button>
            <button
              v-else-if="isRecording"
              @click="stopRecording"
              class="w-56 px-6 py-2 rounded text-sm cursor-pointer transition-colors border-none bg-gray-600 text-white hover:bg-gray-500 flex items-center justify-center gap-2"
            >
              <span class="w-3 h-3 bg-red-500 rounded-sm animate-pulse"></span>
              Stop
            </button>
            <span
              v-else
              class="w-56 px-6 py-2 text-sm text-gray-400 flex items-center justify-center"
            >
              Transcribing...
            </span>

            <button
              @click="nextBeatRecording"
              :disabled="currentPage >= totalBeats - 1 || isRecording || isTranscribing"
              class="px-4 py-2 rounded text-sm cursor-pointer transition-colors border-none disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 text-white hover:bg-gray-500"
            >
              Next
            </button>

            <div class="flex-1"></div>

            <button
              @click="discardRecordings"
              :disabled="savingAudio || isRecording || isTranscribing"
              class="px-4 py-2 rounded text-sm cursor-pointer transition-colors border-none bg-gray-600 text-white hover:bg-gray-500"
            >
              Discard
            </button>
            <button
              @click="saveAllRecordings"
              :disabled="
                (recordedCount === 0 && editedCount === 0) ||
                savingAudio ||
                isRecording ||
                isTranscribing
              "
              class="px-4 py-2 rounded text-sm cursor-pointer transition-colors border-none disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700"
            >
              {{ savingAudio ? "Saving..." : `Save All (${editedCount})` }}
            </button>
          </div>

          <!-- Text editor (always shown in recording mode) -->
          <div class="mt-2">
            <label class="block text-sm text-gray-400 mb-1">
              Text (editable - voice input appends):
            </label>
            <textarea
              v-model="currentEditText"
              rows="4"
              class="w-full bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded text-sm resize-vertical focus:outline-none focus:border-blue-500"
              placeholder="Text will appear here after recording..."
            ></textarea>
          </div>
        </div>

        <MulmoViewer
          :key="recordingMode ? `recording-${currentPage}` : 'viewer'"
          :data-set="viewData"
          :base-path="basePath"
          :init-page="currentPage"
          v-model:audio-lang="audioLang"
          v-model:text-lang="textLang"
          :auto-play="false"
          @updated-page="onUpdatedPage"
        />
      </div>
    </main>
  </div>
</template>

<style>
/* Override mulmocast-viewer text styles for better readability */
.text-gray-800 {
  color: #fff !important;
}

.text-gray-400 {
  color: #bbb !important;
}

.mt-4.px-6.py-4 {
  background: #1f2937;
  border-radius: 0.5rem;
  margin-top: 1rem;
}

/* Add padding to prev/next buttons and content area */
.px-4.py-2.bg-gray-500 {
  margin: 0.5rem;
}

.items-center.justify-center.w-full {
  padding: 0.5rem;
}

.max-w-7xl {
  padding: 0.5rem;
  margin: 0.5rem;
}
</style>

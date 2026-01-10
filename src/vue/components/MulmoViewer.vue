<script setup lang="ts">
import { ref, watch, computed } from "vue";

interface Beat {
  text: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  audioSources?: Record<string, string>;
  multiLinguals?: Record<string, string>;
  imageSource?: string;
}

interface MulmoViewData {
  beats: Beat[];
  lang?: string;
}

const props = defineProps<{
  bundlePath: string;
}>();

const viewData = ref<MulmoViewData | null>(null);
const currentIndex = ref(0);
const currentLang = ref("en");
const loading = ref(true);
const error = ref<string | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);

const currentBeat = computed(() => {
  if (!viewData.value || viewData.value.beats.length === 0) return null;
  return viewData.value.beats[currentIndex.value];
});

const currentText = computed(() => {
  if (!currentBeat.value) return "";
  if (currentBeat.value.multiLinguals && currentBeat.value.multiLinguals[currentLang.value]) {
    return currentBeat.value.multiLinguals[currentLang.value];
  }
  return currentBeat.value.text;
});

const currentImage = computed(() => {
  if (!currentBeat.value?.imageSource) return null;
  return `/bundles/${props.bundlePath}/${currentBeat.value.imageSource}`;
});

const currentAudio = computed(() => {
  if (!currentBeat.value?.audioSources) return null;
  const audioFile = currentBeat.value.audioSources[currentLang.value];
  if (!audioFile) return null;
  return `/bundles/${props.bundlePath}/${audioFile}`;
});

const availableLangs = computed(() => {
  if (!currentBeat.value?.audioSources) return [];
  return Object.keys(currentBeat.value.audioSources);
});

watch(() => props.bundlePath, loadBundle, { immediate: true });

async function loadBundle() {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/bundles/${props.bundlePath}/mulmo_view.json`);
    if (!response.ok) {
      throw new Error("Failed to load bundle");
    }
    viewData.value = await response.json();
    currentIndex.value = 0;
    if (viewData.value?.lang) {
      currentLang.value = viewData.value.lang;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unknown error";
  } finally {
    loading.value = false;
  }
}

function goTo(index: number) {
  if (!viewData.value) return;
  currentIndex.value = Math.max(0, Math.min(index, viewData.value.beats.length - 1));
  isPlaying.value = false;
}

function prev() {
  goTo(currentIndex.value - 1);
}

function next() {
  goTo(currentIndex.value + 1);
}

function togglePlay() {
  if (!audioRef.value) return;
  if (isPlaying.value) {
    audioRef.value.pause();
  } else {
    audioRef.value.play();
  }
  isPlaying.value = !isPlaying.value;
}

function onAudioEnded() {
  isPlaying.value = false;
  if (viewData.value && currentIndex.value < viewData.value.beats.length - 1) {
    next();
    setTimeout(() => {
      if (audioRef.value) {
        audioRef.value.play();
        isPlaying.value = true;
      }
    }, 100);
  }
}
</script>

<template>
  <div class="viewer">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else-if="viewData && currentBeat">
      <div class="slide-container">
        <img v-if="currentImage" :src="currentImage" class="slide-image" alt="Slide" />
        <div v-else class="no-image">No image</div>
      </div>

      <div class="controls">
        <div class="nav-controls">
          <button @click="prev" :disabled="currentIndex === 0">Prev</button>
          <span class="slide-counter">{{ currentIndex + 1 }} / {{ viewData.beats.length }}</span>
          <button @click="next" :disabled="currentIndex === viewData.beats.length - 1">Next</button>
        </div>

        <div class="play-controls">
          <button @click="togglePlay" class="play-btn">
            {{ isPlaying ? "Pause" : "Play" }}
          </button>
          <select v-model="currentLang" v-if="availableLangs.length > 1">
            <option v-for="lang in availableLangs" :key="lang" :value="lang">
              {{ lang.toUpperCase() }}
            </option>
          </select>
        </div>
      </div>

      <div class="text-panel">
        <p>{{ currentText }}</p>
      </div>

      <audio
        ref="audioRef"
        :src="currentAudio || undefined"
        @ended="onAudioEnded"
        style="display: none"
      />
    </template>
  </div>
</template>

<style scoped>
.viewer {
  width: 100%;
  max-width: 1200px;
  padding: 1rem;
}

.loading,
.error {
  text-align: center;
  padding: 2rem;
}

.error {
  color: #ff6b6b;
}

.slide-container {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-image {
  color: #666;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  gap: 1rem;
}

.nav-controls,
.play-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.controls button {
  background: #444;
  border: none;
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.controls button:hover:not(:disabled) {
  background: #555;
}

.controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-btn {
  background: #0066cc !important;
  min-width: 80px;
}

.play-btn:hover:not(:disabled) {
  background: #0077ee !important;
}

.slide-counter {
  color: #888;
  font-size: 0.875rem;
}

.controls select {
  background: #333;
  border: 1px solid #555;
  color: #fff;
  padding: 0.5rem;
  border-radius: 4px;
}

.text-panel {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1rem;
  max-height: 200px;
  overflow-y: auto;
}

.text-panel p {
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>

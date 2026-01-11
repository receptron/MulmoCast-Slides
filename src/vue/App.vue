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

const availableLangs = computed(() => {
  if (!viewData.value?.beats?.[0]?.audioSources) return ["en"];
  return Object.keys(viewData.value.beats[0].audioSources);
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
            :class="selectedBundle === bundle.path
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
            @click="selectBundle(bundle.path)"
          >
            {{ bundle.name }}
          </button>
        </nav>
      </div>
      <div v-if="viewData" class="flex items-center gap-6 px-6 py-2 bg-gray-750 border-t border-gray-700">
        <label class="flex items-center gap-2 text-sm text-gray-300">
          Audio:
          <select
            v-model="audioLang"
            class="bg-gray-700 border border-gray-600 text-white px-2 py-1 rounded text-sm cursor-pointer hover:bg-gray-600"
          >
            <option v-for="lang in availableLangs" :key="lang" :value="lang">
              {{ lang.toUpperCase() }}
            </option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-300">
          Text:
          <select
            v-model="textLang"
            class="bg-gray-700 border border-gray-600 text-white px-2 py-1 rounded text-sm cursor-pointer hover:bg-gray-600"
          >
            <option v-for="lang in availableLangs" :key="lang" :value="lang">
              {{ lang.toUpperCase() }}
            </option>
          </select>
        </label>
      </div>
    </header>

    <main class="flex-1 flex items-center justify-content p-4">
      <div v-if="loading" class="text-center p-8 text-gray-400">Loading bundles...</div>
      <div v-else-if="error" class="text-center p-8 text-red-400">{{ error }}</div>
      <div v-else-if="bundles.length === 0" class="text-center p-8 text-gray-500">
        No bundles found in output/ directory.
        <p class="mt-2">Run <code class="bg-gray-800 px-2 py-1 rounded font-mono text-sm">yarn run cli bundle &lt;file&gt;</code> to generate a bundle.</p>
      </div>
      <div v-else-if="viewData" class="w-full max-w-5xl mx-auto">
        <MulmoViewer
          :data-set="viewData"
          :base-path="basePath"
          :init-page="currentPage"
          v-model:audio-lang="audioLang"
          v-model:text-lang="textLang"
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

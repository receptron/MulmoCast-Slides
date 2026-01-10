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
    if (viewData.value?.lang) {
      audioLang.value = viewData.value.lang;
      textLang.value = viewData.value.lang;
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
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>MulmoViewer Preview</h1>
      <nav v-if="bundles.length > 0" class="bundle-nav">
        <button
          v-for="bundle in bundles"
          :key="bundle.path"
          :class="{ active: selectedBundle === bundle.path }"
          @click="selectBundle(bundle.path)"
        >
          {{ bundle.name }}
        </button>
      </nav>
    </header>

    <main class="main">
      <div v-if="loading" class="loading">Loading bundles...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="bundles.length === 0" class="empty">
        No bundles found in output/ directory.
        <p>Run <code>yarn run cli bundle &lt;file&gt;</code> to generate a bundle.</p>
      </div>
      <div v-else-if="viewData" class="viewer-container">
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

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #2d2d2d;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  border-bottom: 1px solid #444;
}

.header h1 {
  font-size: 1.25rem;
  font-weight: 600;
}

.bundle-nav {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.bundle-nav button {
  background: #444;
  border: none;
  color: #ccc;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.bundle-nav button:hover {
  background: #555;
}

.bundle-nav button.active {
  background: #0066cc;
  color: #fff;
}

.main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 2rem;
}

.error {
  color: #ff6b6b;
}

.empty {
  color: #888;
}

.empty code {
  background: #333;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
}

.viewer-container {
  width: 100%;
  max-width: 1200px;
}
</style>

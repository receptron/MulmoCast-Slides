<script setup lang="ts">
import { ref, onMounted } from "vue";
import MulmoViewer from "./components/MulmoViewer.vue";

interface BundleInfo {
  name: string;
  path: string;
}

const bundles = ref<BundleInfo[]>([]);
const selectedBundle = ref<string | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

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

function selectBundle(path: string) {
  selectedBundle.value = path;
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
        No bundles found in scripts/ directory.
        <p>Run <code>yarn run cli bundle &lt;file&gt;</code> to generate a bundle.</p>
      </div>
      <MulmoViewer v-else-if="selectedBundle" :bundle-path="selectedBundle" />
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
</style>

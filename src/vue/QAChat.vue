<script setup lang="ts">
import { ref, computed, nextTick, watch, onUnmounted } from "vue";
import type { ExtendedMulmoViewerData } from "@mulmocast/extended-types";
import { buildContext } from "./qa-context.js";
import { streamChat } from "./openai-chat.js";
import type { ChatMessage } from "./openai-chat.js";

const SYSTEM_PROMPT = [
  "You are a helpful Q&A assistant for a presentation.",
  "Answer questions about the presentation content based on the context provided.",
  "If the answer is not in the context, say so honestly.",
  "Keep answers concise and relevant.",
  "Respond in the same language as the user's question.",
].join(" ");

const props = defineProps<{
  viewData: ExtendedMulmoViewerData;
  currentPage: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const userInput = ref("");
const messages = ref<ChatMessage[]>([]);
const isStreaming = ref(false);
const streamingText = ref("");
const abortController = ref<AbortController | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);
const chatError = ref<string | null>(null);

const apiKey = computed(() => import.meta.env.VITE_OPENAI_API_KEY ?? "");

const systemMessage = computed<ChatMessage>(() => {
  const context = buildContext(props.viewData);
  return {
    role: "system",
    content: `${SYSTEM_PROMPT}\n\n---\n\n${context}\n\nThe user is currently viewing beat ${props.currentPage}.`,
  };
});

const displayMessages = computed(() => messages.value.filter((m) => m.role !== "system"));

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

watch(streamingText, scrollToBottom);

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isStreaming.value) return;

  chatError.value = null;
  const userMessage: ChatMessage = { role: "user", content: text };

  // Clear input immediately and force DOM update
  userInput.value = "";
  await nextTick();
  messages.value.push(userMessage);
  scrollToBottom();

  isStreaming.value = true;
  streamingText.value = "";
  const controller = new AbortController();
  abortController.value = controller;

  const apiMessages: ChatMessage[] = [systemMessage.value, ...messages.value];

  try {
    const fullResponse = await streamChat(
      apiMessages,
      { apiKey: apiKey.value, signal: controller.signal },
      (chunk) => {
        streamingText.value += chunk;
      }
    );

    messages.value.push({ role: "assistant", content: fullResponse });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      // User cancelled — save partial response if any
      if (streamingText.value) {
        messages.value.push({ role: "assistant", content: streamingText.value });
      }
    } else {
      chatError.value = e instanceof Error ? e.message : "Failed to get response";
    }
  } finally {
    isStreaming.value = false;
    streamingText.value = "";
    abortController.value = null;
    scrollToBottom();
  }
}

function stopStreaming() {
  abortController.value?.abort();
}

function clearChat() {
  messages.value = [];
  streamingText.value = "";
  chatError.value = null;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

onUnmounted(() => {
  abortController.value?.abort();
});
</script>

<template>
  <div
    class="fixed right-0 top-0 h-full w-96 bg-gray-800 border-l border-gray-700 flex flex-col z-50 shadow-2xl"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
      <h2 class="text-sm font-semibold text-white">Q&A Chat</h2>
      <div class="flex gap-2">
        <button
          @click="clearChat"
          :disabled="messages.length === 0 && !isStreaming"
          class="px-2 py-1 text-xs rounded cursor-pointer transition-colors border-none bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <button
          @click="emit('close')"
          class="px-2 py-1 text-xs rounded cursor-pointer transition-colors border-none bg-gray-700 text-gray-300 hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    </div>

    <!-- Messages area -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3">
      <div
        v-if="displayMessages.length === 0 && !isStreaming"
        class="text-center text-gray-500 text-sm mt-8"
      >
        Ask a question about this presentation.
      </div>

      <div
        v-for="(msg, i) in displayMessages"
        :key="i"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words"
          :class="msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'"
        >
          {{ msg.content }}
        </div>
      </div>

      <!-- Streaming response -->
      <div v-if="isStreaming && streamingText" class="flex justify-start">
        <div
          class="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-gray-700 text-gray-200 whitespace-pre-wrap break-words"
        >
          {{ streamingText }}
          <span class="animate-pulse">|</span>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="isStreaming && !streamingText" class="flex justify-start">
        <div class="px-3 py-2 rounded-lg text-sm bg-gray-700 text-gray-400">
          <span class="animate-pulse">Thinking...</span>
        </div>
      </div>

      <!-- Error -->
      <div v-if="chatError" class="p-2 bg-red-900/50 text-red-300 rounded text-xs">
        {{ chatError }}
      </div>
    </div>

    <!-- Input area -->
    <div class="border-t border-gray-700 p-3">
      <div class="flex gap-2">
        <textarea
          v-model="userInput"
          @keydown="handleKeydown"
          :disabled="isStreaming"
          rows="2"
          class="flex-1 bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded text-sm resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
          placeholder="Ask about this presentation..."
        ></textarea>
        <div class="flex flex-col gap-1">
          <button
            v-if="!isStreaming"
            @click="sendMessage"
            :disabled="!userInput.trim()"
            class="px-3 py-2 rounded text-sm cursor-pointer transition-colors border-none bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
          <button
            v-else
            @click="stopStreaming"
            class="px-3 py-2 rounded text-sm cursor-pointer transition-colors border-none bg-red-600 text-white hover:bg-red-700"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

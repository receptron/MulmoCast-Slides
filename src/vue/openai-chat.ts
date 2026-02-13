const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const IDLE_TIMEOUT_MS = 30_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
}

export type StreamCallback = (chunk: string) => void;

function parseSSELine(line: string): string | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice("data: ".length);
  if (data === "[DONE]") return null;

  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return parsed.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

export async function streamChat(
  messages: ChatMessage[],
  options: ChatOptions,
  onChunk: StreamCallback
): Promise<string> {
  const timeoutController = new AbortController();
  let timeoutId = setTimeout(() => timeoutController.abort(), IDLE_TIMEOUT_MS);

  function resetIdleTimeout() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => timeoutController.abort(), IDLE_TIMEOUT_MS);
  }

  // Combine user-provided signal with timeout signal
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_MODEL,
        messages,
        stream: true,
      }),
      signal: combinedSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const resultParts: string[] = [];
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? "";

      lines.forEach((line) => {
        const content = parseSSELine(line.trim());
        if (content) {
          resultParts.push(content);
          onChunk(content);
          resetIdleTimeout();
        }
      });
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const content = parseSSELine(buffer.trim());
      if (content) {
        resultParts.push(content);
        onChunk(content);
      }
    }

    return resultParts.join("");
  } finally {
    clearTimeout(timeoutId);
  }
}

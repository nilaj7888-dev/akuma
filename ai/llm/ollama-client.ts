import { ollamaConfig } from "./model-config";

export type OllamaMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> };
export type OllamaTool = { type: "function"; function: { name: string; description: string; parameters: { type: "object"; properties: Record<string, unknown>; required: string[] } } };

type ChatResponse = { message?: OllamaMessage; done?: boolean; total_duration?: number };

export async function ollamaHealth() {
  const started = Date.now();
  try {
    const response = await fetch(`${ollamaConfig.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3_000) });
    return { connected: response.ok, latencyMs: Date.now() - started, model: ollamaConfig.model };
  } catch {
    return { connected: false, latencyMs: Date.now() - started, model: ollamaConfig.model };
  }
}

export async function ollamaChat(messages: OllamaMessage[], tools: OllamaTool[]) {
  const response = await fetch(`${ollamaConfig.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Qwen3's hidden reasoning mode is useful for deep work but makes ordinary
    // dashboard chats look stalled. Keep tool use enabled while returning direct,
    // responsive answers to the user.
    body: JSON.stringify({ model: ollamaConfig.model, messages, tools, stream: false, think: false }),
    signal: AbortSignal.timeout(ollamaConfig.timeoutMs),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  return await response.json() as ChatResponse;
}

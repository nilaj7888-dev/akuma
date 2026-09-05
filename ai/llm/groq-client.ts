import Groq from "groq-sdk";
import { groqConfig, groqConfigured } from "./model-config";

// ── Wire-agnostic message shapes used across the AKUMA agent ─────
// Tool-call arguments are kept as objects here (Groq sends/receives them as
// JSON strings); the conversion happens at this boundary so callers never
// have to think about it.

export type AiToolCall = {
  id: string;
  function: { name: string; arguments: Record<string, unknown> };
};

export type AiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: AiToolCall[];
  /** Required by Groq on `role: "tool"` messages — links a result to its call. */
  tool_call_id?: string;
};

export type AiTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: { type: "object"; properties: Record<string, unknown>; required: string[] };
  };
};

export class GroqNotConfiguredError extends Error {
  constructor() {
    super("GROQ_API_KEY is not set. Add it to .env.local to enable the AKUMA agent.");
    this.name = "GroqNotConfiguredError";
  }
}

let cachedClient: Groq | null = null;

/** Lazily created, memoized Groq client initialized from process.env.GROQ_API_KEY. */
export function getGroqClient(): Groq {
  if (!groqConfigured()) throw new GroqNotConfiguredError();
  if (!cachedClient) {
    cachedClient = new Groq({
      apiKey: groqConfig.apiKey,
      timeout: groqConfig.timeoutMs,
      maxRetries: groqConfig.maxRetries,
    });
  }
  return cachedClient;
}

// ── Groq wire types ──────────────────────────────────────────────
// Hand-declared rather than imported from groq-sdk: the SDK's request types are
// heavily overloaded and shift between 0.x releases, and this module is the only
// place in AKUMA that touches them. Everything we send and read is below.

type WireToolCall = {
  id: string;
  type: "function";
  /** Groq sends and expects tool arguments as a JSON *string*, not an object. */
  function: { name: string; arguments: string };
};

type WireMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: WireToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type WireRequest = {
  model: string;
  messages: WireMessage[];
  tools?: AiTool[];
  tool_choice?: "auto" | "none" | "required";
  temperature?: number;
  max_tokens?: number;
  stream?: false;
};

type WireResponse = {
  choices?: Array<{
    message?: { content?: string | null; tool_calls?: Array<Partial<WireToolCall>> };
    finish_reason?: string | null;
  }>;
};

type GroqApi = {
  chat: { completions: { create: (body: WireRequest) => Promise<WireResponse> } };
  models: { list: (options?: { timeout?: number; maxRetries?: number }) => Promise<unknown> };
};

/**
 * The Groq client narrowed to the two endpoints AKUMA calls, typed against the
 * wire types above so this module compiles against any groq-sdk 0.x.
 */
export function getGroqApi(): GroqApi {
  return getGroqClient() as unknown as GroqApi;
}

// ── Model resolution ─────────────────────────────────────────────
// Groq retires model IDs on a rolling basis and gates others behind per-account
// access, so ANY hardcoded name eventually fails with 404 model_not_found —
// which is exactly what llama-3.3-70b-versatile and llama-3.1-8b-instant both
// did on this key. Instead of guessing another name, ask the key what it can
// actually use, then cache that answer for the life of the process.

/** Discovered-good model id, once a call has actually succeeded with it. */
let resolvedModel: string | null = null;
/** In-flight discovery, so concurrent chats don't each hit /models. */
let modelDiscovery: Promise<string | null> | null = null;

/** True for the "model does not exist or you do not have access to it" failure. */
function isModelNotFound(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    status === 404 ||
    /model_not_found|does not exist or you do not have access/i.test(message)
  );
}

/** Groq hosts these, but they can't serve a normal chat turn. */
const NON_CHAT_MODEL = /whisper|tts|embed|guard|moderation/i;

/**
 * Rank chat models by how well they suit the AKUMA agent, which needs solid
 * tool-calling. Bigger Llama instruct models first, then anything else usable.
 */
function scoreModel(id: string): number {
  const lower = id.toLowerCase();
  if (NON_CHAT_MODEL.test(lower)) return -1;
  let score = 0;
  if (lower.includes("llama")) score += 40;
  if (lower.includes("versatile")) score += 30;
  if (lower.includes("instant")) score += 20;
  if (lower.includes("70b")) score += 15;
  if (lower.includes("8b")) score += 8;
  if (lower.includes("preview")) score -= 12;
  return score;
}

/** Pull `data[].id` out of the SDK's model list without trusting its shape. */
function extractModelIds(payload: unknown): string[] {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => (entry as { id?: unknown } | null)?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * Ask the configured key which models it can use and pick the best chat one.
 * Returns null when the list can't be fetched (bad key, network, etc.).
 */
async function discoverModel(): Promise<string | null> {
  if (!modelDiscovery) {
    modelDiscovery = (async () => {
      try {
        const ids = extractModelIds(await getGroqApi().models.list({ timeout: 10_000, maxRetries: 0 }));
        if (ids.length === 0) {
          console.error("[Groq] Model discovery returned no models for this API key.");
          return null;
        }

        // Printed in full so the terminal names the valid GROQ_MODEL values.
        console.log(`[Groq] Models available to this key: ${ids.join(", ")}`);

        const usable = ids.filter((id) => scoreModel(id) >= 0).sort((a, b) => scoreModel(b) - scoreModel(a));
        if (usable.length === 0) {
          console.error("[Groq] This key exposes no chat-capable models.");
          return null;
        }

        console.log(`[Groq] Selected fallback model: ${usable[0]}`);
        return usable[0];
      } catch (error) {
        console.error("[Groq] Could not list models for this API key:", error);
        return null;
      } finally {
        // Allow a later retry rather than caching a transient failure forever.
        if (!resolvedModel) modelDiscovery = null;
      }
    })();
  }
  return modelDiscovery;
}

function toWireMessage(message: AiMessage): WireMessage {
  if (message.role === "tool") {
    return { role: "tool" as const, tool_call_id: message.tool_call_id ?? "", content: message.content };
  }
  if (message.role === "system") {
    return { role: "system" as const, content: message.content };
  }
  if (message.role === "user") {
    return { role: "user" as const, content: message.content };
  }
  if (message.tool_calls?.length) {
    return {
      role: "assistant" as const,
      content: message.content || null,
      tool_calls: message.tool_calls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.function.name, arguments: JSON.stringify(call.function.arguments ?? {}) },
      })),
    };
  }
  return { role: "assistant" as const, content: message.content };
}

function parseArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * One turn of a Groq chat completion. Tools are only sent when non-empty —
 * Groq rejects an empty `tools` array.
 */
export async function groqChat(
  messages: AiMessage[],
  tools: AiTool[]
): Promise<{ message: AiMessage; finishReason: string | null }> {
  // Ensure GROQ_API_KEY is set before making the call
  if (!groqConfigured()) {
    throw new GroqNotConfiguredError();
  }

  try {
    // Precedence: a model already proven to work this process → an explicit
    // GROQ_MODEL from the environment → whatever the key actually exposes.
    // When nothing is pinned we discover first rather than burning a request
    // on a hardcoded guess that may well have been retired.
    const pinnedModel = process.env.GROQ_MODEL?.trim();
    const model = resolvedModel || pinnedModel || (await discoverModel()) || groqConfig.model;

    const requestBody: WireRequest = {
      model,
      messages: messages.map(toWireMessage),
      // Groq rejects an empty `tools` array, so the field is left off entirely
      // when the router scoped this message down to no tools.
      ...(tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
      temperature: 0.3,
      max_tokens: 1400,
      stream: false,
    };

    console.log(`[Groq] Calling model: ${requestBody.model}, with ${requestBody.messages.length} messages, ${tools.length} tools`);

    let completion: WireResponse;
    try {
      completion = await getGroqApi().chat.completions.create(requestBody);
    } catch (error: unknown) {
      // Only a dead/inaccessible model name is recoverable here; anything else
      // (401 bad key, 429 rate limit) must surface untouched.
      if (!isModelNotFound(error)) throw error;

      console.error(`[Groq] Model "${requestBody.model}" is unavailable to this key. Discovering a replacement...`);
      const fallback = await discoverModel();
      if (!fallback || fallback === requestBody.model) throw error;

      requestBody.model = fallback;
      completion = await getGroqApi().chat.completions.create(requestBody);
      console.log(`[Groq] Recovered using model: ${fallback}. Set GROQ_MODEL="${fallback}" in .env.local to skip this lookup.`);
    }

    // Remember what actually worked for the rest of this process.
    resolvedModel = requestBody.model;

    // Narrowed off `choice` (not `message`) so `finish_reason` below is also known
    // to be present.
    const choice = completion.choices?.[0];
    if (!choice?.message) {
      const errorMsg = `Groq returned no message. Response: ${JSON.stringify(completion)}`;
      console.error(`[Groq Error] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    const raw = choice.message;

    const toolCalls = (raw.tool_calls ?? []).flatMap((call, index) => {
      const fn = call.function;
      if (!fn?.name) return [];
      return [
        {
          id: call.id || `call_${index}`,
          function: { name: fn.name, arguments: parseArguments(fn.arguments) },
        },
      ];
    });

    console.log(`[Groq] Success: Got response with ${toolCalls.length} tool calls`);

    return {
      message: {
        role: "assistant",
        content: raw.content ?? "",
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finishReason: choice.finish_reason ?? null,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Groq API error";
    console.error(`[Groq API Error] ${errorMessage}`, error);
    throw error;
  }
}

// ── Health ───────────────────────────────────────────────────────
// The chat path uses the synchronous groqConfigured() check; this probe is for
// the /api/ai/health endpoint, so it is cached to avoid hammering Groq.

type Health = { connected: boolean; latencyMs: number; model: string; error?: string };
const HEALTH_TTL_MS = 30_000;
let cachedHealth: { at: number; value: Health } | null = null;

export async function groqHealth(): Promise<Health> {
  if (cachedHealth && Date.now() - cachedHealth.at < HEALTH_TTL_MS) return cachedHealth.value;

  const started = Date.now();
  let value: Health;
  if (!groqConfigured()) {
    value = { connected: false, latencyMs: 0, model: groqConfig.model, error: "GROQ_API_KEY is not set." };
  } else {
    try {
      await getGroqApi().models.list({ timeout: 5_000, maxRetries: 0 });
      value = { connected: true, latencyMs: Date.now() - started, model: groqConfig.model };
    } catch (error: unknown) {
      value = {
        connected: false,
        latencyMs: Date.now() - started,
        model: groqConfig.model,
        error: error instanceof Error ? error.message : "Groq is unreachable.",
      };
    }
  }

  cachedHealth = { at: Date.now(), value };
  return value;
}

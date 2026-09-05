import { beforeEach, describe, expect, it, vi } from "vitest";
import { groqChat, type AiMessage, type AiTool } from "../ai/llm/groq-client";

// `vi.hoisted` runs before every import, so this both pins the Groq config that
// ai/llm/model-config.ts reads at module load and gives the SDK stub below a
// place to record calls.
const state = vi.hoisted(() => {
  process.env.GROQ_API_KEY = "test-key";
  process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
  return {
    lastBody: null as Record<string, unknown> | null,
    reply: { choices: [] } as unknown,
  };
});

// Stub the SDK — these tests are about AKUMA's side of the wire, not Groq's.
vi.mock("groq-sdk", () => {
  class FakeGroq {
    chat = {
      completions: {
        create: async (body: Record<string, unknown>) => {
          state.lastBody = body;
          return state.reply;
        },
      },
    };
    models = { list: async () => ({ data: [] }) };
  }
  return { default: FakeGroq };
});

/** The shape groqChat is expected to put on the wire. */
type SentBody = {
  model: string;
  messages: Array<{
    role: string;
    content: string | null;
    tool_call_id?: string;
    tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  }>;
  tools?: unknown[];
  tool_choice?: string;
};

const TOOLS: AiTool[] = [
  {
    type: "function",
    function: {
      name: "searchProducts",
      description: "Search the catalog",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
];

function reply(value: unknown): void {
  state.reply = value;
}

function sent(): SentBody {
  if (!state.lastBody) throw new Error("Groq was never called.");
  return state.lastBody as SentBody;
}

beforeEach(() => {
  state.lastBody = null;
  state.reply = { choices: [] };
});

describe("request body", () => {
  it("omits tools entirely when none are in scope — Groq 400s on tools: []", async () => {
    reply({ choices: [{ message: { content: "hi" }, finish_reason: "stop" }] });
    await groqChat([{ role: "user", content: "hello" }], []);

    expect("tools" in sent()).toBe(false);
    expect("tool_choice" in sent()).toBe(false);
    expect(sent().model).toBe("llama-3.3-70b-versatile");
  });

  it("forwards tools with tool_choice auto when there are some", async () => {
    reply({ choices: [{ message: { content: "hi" }, finish_reason: "stop" }] });
    await groqChat([{ role: "user", content: "hello" }], TOOLS);

    expect(sent().tools).toHaveLength(1);
    expect(sent().tool_choice).toBe("auto");
  });

  it("stringifies tool-call arguments and keeps tool_call_id on results", async () => {
    reply({ choices: [{ message: { content: "done" }, finish_reason: "stop" }] });
    const history: AiMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "find socks" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "call_abc", function: { name: "searchProducts", arguments: { query: "socks" } } }],
      },
      { role: "tool", tool_call_id: "call_abc", content: '{"products":[]}' },
    ];
    await groqChat(history, TOOLS);
    const [sys, user, assistant, tool] = sent().messages;

    expect(sys).toEqual({ role: "system", content: "sys" });
    expect(user).toEqual({ role: "user", content: "find socks" });
    // Empty assistant content must go out as null, not "".
    expect(assistant.content).toBeNull();
    expect(assistant.tool_calls?.[0].type).toBe("function");
    expect(typeof assistant.tool_calls?.[0].function.arguments).toBe("string");
    expect(JSON.parse(assistant.tool_calls?.[0].function.arguments ?? "{}")).toEqual({ query: "socks" });
    expect(tool).toEqual({ role: "tool", tool_call_id: "call_abc", content: '{"products":[]}' });
  });
});

describe("response parsing", () => {
  it("parses a stringified arguments payload back into an object", async () => {
    reply({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: "call_1", type: "function", function: { name: "getStoreMetrics", arguments: '{"days":30}' } },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    });

    const { message, finishReason } = await groqChat([{ role: "user", content: "metrics?" }], TOOLS);
    expect(message.content).toBe("");
    expect(finishReason).toBe("tool_calls");
    expect(message.tool_calls).toEqual([
      { id: "call_1", function: { name: "getStoreMetrics", arguments: { days: 30 } } },
    ]);
  });

  it("degrades unparseable or missing arguments to {} instead of throwing", async () => {
    reply({
      choices: [
        {
          message: {
            tool_calls: [
              { id: "a", function: { name: "getProducts", arguments: "not json" } },
              { id: "b", function: { name: "getMerchantPolicy" } },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    });

    const { message } = await groqChat([{ role: "user", content: "x" }], TOOLS);
    expect(message.tool_calls?.map((call) => call.function.arguments)).toEqual([{}, {}]);
  });
});

describe("malformed responses", () => {
  it("drops a nameless tool call and gives a missing id a positional fallback", async () => {
    reply({
      choices: [
        {
          message: {
            tool_calls: [
              { id: "keep", function: { name: "getProducts", arguments: "{}" } },
              { id: "drop", function: {} },
              { function: { name: "getMerchantPolicy", arguments: "{}" } },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    });

    const { message } = await groqChat([{ role: "user", content: "x" }], TOOLS);
    expect(message.tool_calls?.map((call) => [call.id, call.function.name])).toEqual([
      ["keep", "getProducts"],
      ["call_2", "getMerchantPolicy"],
    ]);
  });

  it("throws rather than returning an empty turn when there are no choices", async () => {
    reply({ choices: [] });
    await expect(groqChat([{ role: "user", content: "x" }], [])).rejects.toThrow("Groq returned no message");
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  MAX_REWRITE_CHARS,
  NEGOTIATION_TONES,
  REWRITE_SYSTEM_PROMPT,
  buildRewriteSystemPrompt,
  cleanRewrite,
  extractAmounts,
  normalizeRole,
  normalizeTone,
  preservesAmounts,
  rewriteNegotiationText,
} from "../lib/ai-negotiator";

// Pin the Groq config so the no-key passthrough path is deterministic and the
// Groq SDK is never loaded (it is imported lazily, only after this check).
vi.mock("@/ai/llm/model-config", () => ({
  groqConfig: {
    apiKey: "",
    model: "llama-3.3-70b-versatile",
    fastModel: "llama-3.1-8b-instant",
    timeoutMs: 60_000,
    maxRetries: 2,
  },
  groqConfigured: () => false,
  availableToolNames: [],
}));

describe("tone normalization", () => {
  it("accepts the supported tones regardless of case or padding", () => {
    expect(NEGOTIATION_TONES).toEqual(["Professional", "Firm", "Friendly", "Urgent", "Persuasive"]);
    expect(normalizeTone("firm")).toBe("Firm");
    expect(normalizeTone("  URGENT  ")).toBe("Urgent");
    expect(normalizeTone("Persuasive")).toBe("Persuasive");
  });

  it("falls back to Professional for anything unrecognized", () => {
    expect(normalizeTone("sarcastic")).toBe("Professional");
    expect(normalizeTone("")).toBe("Professional");
    expect(normalizeTone(undefined)).toBe("Professional");
  });

  it("treats every role except MERCHANT as the buyer", () => {
    expect(normalizeRole("merchant")).toBe("MERCHANT");
    expect(normalizeRole(" MERCHANT ")).toBe("MERCHANT");
    expect(normalizeRole("BUYER")).toBe("BUYER");
    expect(normalizeRole("CONSUMER")).toBe("BUYER");
    expect(normalizeRole(null)).toBe("BUYER");
  });
});

describe("system prompt", () => {
  it("leads with the AKUMA middleman prompt and names the tone", () => {
    const prompt = buildRewriteSystemPrompt("BUYER", "Firm");
    expect(prompt.startsWith(REWRITE_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("Requested tone: Firm");
    expect(prompt).toContain("buyer making or responding to an offer");
  });

  it("describes the merchant side when the merchant is writing", () => {
    expect(buildRewriteSystemPrompt("MERCHANT", "Friendly")).toContain("merchant (seller) replying to a buyer");
  });
});

describe("cleaning model output", () => {
  it("drops a preamble line and wrapping quotes", () => {
    expect(cleanRewrite("Here's the rewritten message:\nI can offer ₹4,500.")).toBe("I can offer ₹4,500.");
    expect(cleanRewrite('"I can offer ₹4,500."')).toBe("I can offer ₹4,500.");
    expect(cleanRewrite("  Sure, here it is:\n\nFinal offer: ₹900.  ")).toBe("Final offer: ₹900.");
  });

  it("leaves a legitimate message untouched", () => {
    expect(cleanRewrite("Dear Sir:\nMy offer is ₹4,500.")).toBe("Dear Sir:\nMy offer is ₹4,500.");
    expect(cleanRewrite("I can offer ₹4,500.")).toBe("I can offer ₹4,500.");
  });
});

describe("amount preservation", () => {
  it("normalizes currency formatting before comparing", () => {
    expect(extractAmounts("₹4,500 for 12 units")).toEqual(["4500", "12"]);
    expect(extractAmounts("no numbers here")).toEqual([]);
    expect(preservesAmounts("₹4,500 for 12 units", "For 12 units I can pay 4500 rupees.")).toBe(true);
  });

  it("catches a dropped or altered number", () => {
    expect(preservesAmounts("₹4,500 for 12 units", "I can pay ₹4,500.")).toBe(false);
    expect(preservesAmounts("₹4,500 for 12 units", "₹4,000 for 12 units")).toBe(false);
  });
});

describe("rewriteNegotiationText without a Groq key", () => {
  it("passes the original text through instead of throwing", async () => {
    const result = await rewriteNegotiationText({
      rawInput: "  I want ₹4,500 for 12 units.  ",
      targetTone: "firm",
      role: "merchant",
    });
    expect(result).toEqual({
      text: "I want ₹4,500 for 12 units.",
      tone: "Firm",
      role: "MERCHANT",
      rewritten: false,
      model: null,
      reason: "GROQ_API_KEY is not set.",
    });
  });

  it("rejects empty and oversized input before calling out", async () => {
    expect(await rewriteNegotiationText({ rawInput: "   ", targetTone: "Firm", role: "BUYER" })).toMatchObject({
      text: "",
      rewritten: false,
      reason: "Empty message.",
    });

    const tooLong = "a".repeat(MAX_REWRITE_CHARS + 1);
    expect(await rewriteNegotiationText({ rawInput: tooLong, targetTone: "Firm", role: "BUYER" })).toMatchObject({
      rewritten: false,
      reason: `Message exceeds ${MAX_REWRITE_CHARS} characters.`,
    });
  });
});

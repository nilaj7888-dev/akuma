export const groqConfig = {
  apiKey: process.env.GROQ_API_KEY ?? "",
  /**
   * Reasoning + tool-calling model for the AKUMA agent.
   *
   * Groq returned 404 model_not_found for llama-3.3-70b-versatile on this
   * account (2026-09-05), so the default is the instant model, which this key
   * does have access to. NOTE: GROQ_MODEL in .env.local overrides this, so
   * changing the default alone is not enough.
   */
  model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  /** Cheaper, faster model used for short single-shot work like tone rewriting. */
  fastModel: process.env.GROQ_FAST_MODEL || "llama-3.1-8b-instant",
  timeoutMs: 60_000,
  maxRetries: 2,
};

/** True when a Groq API key is configured. Synchronous — no network call. */
export function groqConfigured(): boolean {
  return groqConfig.apiKey.trim().length > 0;
}

export const availableToolNames = [
  "searchProducts",
  "getStoreMetrics",
  "getTopProducts",
  "getCustomerSegments",
  "getProductAffinity",
  "getRevenueTrends",
  "getMerchantPolicy",
  "getProducts",
  "simulateOffer",
  "checkGuardrails",
  "proposeCampaign",
] as const;

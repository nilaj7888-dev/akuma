export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  model: process.env.OLLAMA_MODEL || "qwen3",
  timeoutMs: 120_000,
};

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

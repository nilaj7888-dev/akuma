import { getOnboarding } from "@/lib/onboarding";
import { ollamaChat, type OllamaMessage } from "../llm/ollama-client";
import { aiTools, executeAiTool } from "../tools";

// ── System Prompts ───────────────────────────────────────────────

const MERCHANT_SYSTEM = `You are AKUMA, an intelligent commerce agent for merchants.

IDENTITY: You are a competent, evidence-first business analyst. You speak naturally, concisely, and professionally — like a skilled employee, not a chatbot.

CORE LOOP: UNDERSTAND → INVESTIGATE → USE TOOLS → REASON OVER DATA → PROPOSE → EXPLAIN → CHECK POLICY → ASK FOR APPROVAL.

RULES:
1. ALWAYS use tools for factual data. NEVER invent revenue, percentages, customer counts, product names, prices, or stock levels.
2. For multi-step questions (e.g. "find the best opportunity"), call multiple tools: getStoreMetrics, getTopProducts, getProductAffinity, getMerchantPolicy, then reason over ALL results before responding.
3. Before proposing any campaign or discount, call checkGuardrails or simulateOffer first. If guardrails reject it, explain why.
4. Call proposeCampaign only when you have data-backed evidence AND guardrails pass. The campaign requires merchant approval.
5. Distinguish ANALYSIS (safe) from SIMULATION (safe) from PROPOSAL (creates record) from EXECUTION (requires approval).
6. When recommending, always cite the evidence: co-purchase rate, order count, customer count, revenue figures — from tool results.
7. If data is unavailable, say "I don't have enough data for that." Never hallucinate.
8. After completing analysis, suggest 2-4 relevant next actions.
9. Keep responses concise. Don't write essays for simple questions.
10. Never expose tool names, JSON, or chain-of-thought to the user. Only share insights and recommendations.
11. Remember conversation context. If the user says "that" or "try it", resolve the reference from prior messages.
12. When a discount exceeds policy limits, explain the limit and offer the maximum allowed alternative.

RESPONSE FORMAT: Direct answer → Evidence (if relevant) → Recommended next step.`;

const BUYER_SYSTEM = `You are AKUMA, an intelligent shopping assistant.

IDENTITY: You are a helpful, knowledgeable shopping guide. You speak naturally and concisely.

CORE LOOP: UNDERSTAND INTENT → ASK ONLY IF NEEDED → SEARCH PRODUCTS → COMPARE → RECOMMEND → EXPLAIN WHY.

RULES:
1. ALWAYS search products using tools. NEVER invent products, prices, or availability.
2. Don't ask questions when the answer is already in the conversation. If the user said "under ₹5,000", you know the budget.
3. Ask smart follow-up questions only when information is genuinely missing (e.g. use case, preference).
4. When comparing products, use real attributes: price, category, stock, not made-up specs.
5. If a product is too expensive, proactively search for alternatives without being asked.
6. Remember what products have been discussed, selected, or rejected in this conversation.
7. Format prices clearly. Stock levels matter — never recommend out-of-stock items.
8. For negotiation requests, explain honestly whether discounts are available based on merchant policy.
9. Keep responses concise and natural. No robotic language.`;

const MAX_TOOL_LOOPS = 8;

function toolsForMessage(role: "MERCHANT" | "BUYER", message: string) {
  const text = message.toLowerCase();
  if (role === "BUYER") {
    return aiTools.filter((tool) => ["searchProducts", "getProducts"].includes(tool.function.name));
  }

  const requested = new Set<string>();
  if (/revenue|sales|store|metric|performance|health/.test(text)) requested.add("getStoreMetrics");
  if (/product|catalog|stock|sell|selling|inventory/.test(text)) {
    requested.add("getTopProducts");
    requested.add("getProducts");
  }
  if (/customer|segment|retention|loyal/.test(text)) requested.add("getCustomerSegments");
  if (/cross.?sell|bundle|together|affinity/.test(text)) requested.add("getProductAffinity");
  if (/trend|growth|decline|month|week/.test(text)) requested.add("getRevenueTrends");
  if (/discount|policy|guardrail|offer|campaign|price/.test(text)) {
    requested.add("getMerchantPolicy");
    requested.add("checkGuardrails");
    requested.add("simulateOffer");
    requested.add("proposeCampaign");
  }
  if (/opportunity|analy[sz]e|recommend|best/.test(text)) {
    requested.add("getStoreMetrics");
    requested.add("getTopProducts");
    requested.add("getProductAffinity");
    requested.add("getMerchantPolicy");
  }
  return aiTools.filter((tool) => requested.has(tool.function.name));
}

// ── Agent Runner ─────────────────────────────────────────────────

export async function runAkumaAgent(input: {
  username: string;
  role: "MERCHANT" | "BUYER";
  message: string;
  history?: OllamaMessage[];
}): Promise<{ content: string; toolActivity: string[] }> {
  const context = getOnboarding(input.username);

  const contextSummary =
    input.role === "MERCHANT"
      ? {
        role: "MERCHANT",
        businessName: context?.businessName ?? "Nova Electronics",
        categories: context?.categories,
        goal: context?.primaryGoal,
        negotiation: context?.negotiationPreference,
      }
      : {
        role: "BUYER",
        priority: context?.buyerPriority,
        condition: context?.conditionPreference,
        negotiation: context?.negotiationPreference,
      };

  const systemPrompt = input.role === "MERCHANT" ? MERCHANT_SYSTEM : BUYER_SYSTEM;

  const messages: OllamaMessage[] = [
    {
      role: "system",
      content: `${systemPrompt}\n\nAuthenticated context: ${JSON.stringify(contextSummary)}`,
    },
    ...(input.history ?? []).slice(-12),
    { role: "user", content: input.message },
  ];

  const toolActivity: string[] = [];
  const tools = toolsForMessage(input.role, input.message);

  for (let step = 0; step < MAX_TOOL_LOOPS; step++) {
    const response = await ollamaChat(messages, tools);
    const message = response.message;

    if (!message) throw new Error("AI returned no response.");

    // No tool calls → final response
    if (!message.tool_calls?.length) {
      return { content: message.content, toolActivity };
    }

    // Process tool calls
    messages.push(message);

    for (const call of message.tool_calls) {
      const toolName = call.function.name;

      // Permission check: buyers can only use searchProducts and getProducts
      if (input.role === "BUYER" && !["searchProducts", "getProducts"].includes(toolName)) {
        messages.push({ role: "tool", content: JSON.stringify({ error: `Tool ${toolName} is not available as a buyer.` }) });
        toolActivity.push(`${toolName} (denied)`);
        continue;
      }

      toolActivity.push(toolName);

      try {
        const result = await executeAiTool(toolName, call.function.arguments, input.role);
        messages.push({ role: "tool", content: JSON.stringify(result) });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        messages.push({ role: "tool", content: JSON.stringify({ error: errorMessage }) });
      }
    }
  }

  return {
    content: "I reached the maximum number of analysis steps. Here's what I found so far based on the tools I called. Please ask a more specific question if you need further detail.",
    toolActivity,
  };
}

// ── Safe Fallback (no LLM) ───────────────────────────────────────

export async function runSafeFallback(input: { role: "MERCHANT" | "BUYER"; message: string }): Promise<{
  provider: string;
  content: string;
  toolActivity: string[];
}> {
  if (input.role === "BUYER") {
    const result = (await executeAiTool("searchProducts", { query: input.message }, "BUYER")) as {
      products?: Array<{ name: string; pricePaise: number; priceDisplay: string; stock: number }>;
    };
    const products = result.products ?? [];
    if (products.length) {
      return {
        provider: "deterministic-fallback",
        content: `I found ${products.length} product${products.length === 1 ? "" : "s"}: ${products.map((p) => `${p.name} (${p.priceDisplay})`).join(", ")}. Start Ollama for conversational shopping.`,
        toolActivity: ["searchProducts"],
      };
    }
    return {
      provider: "deterministic-fallback",
      content: "I could not find products matching that request. Start Ollama for conversational search.",
      toolActivity: ["searchProducts"],
    };
  }

  const metrics = (await executeAiTool("getStoreMetrics", {}, "MERCHANT")) as {
    totalRevenueDisplay?: string;
    totalOrders?: number;
    totalCustomers?: number;
  };
  return {
    provider: "deterministic-fallback",
    content: `Your store has ${metrics.totalOrders ?? 0} orders, ${metrics.totalCustomers ?? 0} customers, and ${metrics.totalRevenueDisplay ?? "₹0"} in revenue. Start Ollama for intelligent analysis and recommendations.`,
    toolActivity: ["getStoreMetrics"],
  };
}

import { getOnboarding } from "@/lib/onboarding";
import { groqChat, type AiMessage } from "../llm/groq-client";
import { groqConfig, groqConfigured } from "../llm/model-config";
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

IDENTITY: You are a helpful, knowledgeable shopping guide. You speak naturally and concisely — like a friend helping them shop.

CORE LOOP: UNDERSTAND INTENT → ASK ONLY MISSING INFO → SEARCH PRODUCTS → COMPARE → RECOMMEND → EXPLAIN WHY.

CRITICAL RULES FOR CONVERSATIONS:
1. GATHER INFO PROGRESSIVELY, NOT ALL AT ONCE
   - Ask ONE or TWO natural follow-up questions per turn
   - Never ask every question in a list
   - Ask only when information is genuinely missing
   - If user already said "₹5,000 budget", you KNOW the budget — don't ask again

2. REMEMBER WHAT WAS DISCUSSED
   - Track: product category, budget, quantity, brand preference, specs, location, delivery needs, new/used preference
   - If user says "headphones" + "gaming" + "₹5,000", you have 3 pieces of info — use them all
   - Don't re-ask questions the user already answered in THIS conversation
   - Reference previous answers: "You mentioned gaming, so..."

3. ASK SMART FOLLOW-UPS (CATEGORY-AWARE)
   - After "I need headphones": Ask use case (gaming? music? calls?)
   - After "gaming headphones": Ask budget
   - After budget: Ask wired vs wireless OR brand preference (whichever is more relevant)
   - Stop asking when you have enough info to search effectively

   CATEGORY-SPECIFIC QUESTIONS (ask naturally, one at a time):
   • Electronics (phones, laptops, headphones): Budget → specs (RAM/storage/screen) → brand preference → new/refurb
   • Clothing/Fashion: Size → color/style → occasion → material preference
   • Food/Groceries: Quantity → dietary restrictions → organic preference → delivery date
   • Furniture: Room dimensions → style (modern/traditional) → assembly preference → delivery logistics
   • Books: Genre → language → new/used → format (hardcover/paperback/ebook)
   • Sports equipment: Skill level → indoor/outdoor → brand → size/fit
   • Beauty products: Skin type → concerns → ingredient preferences → brand loyalty
   • Home appliances: Space constraints → energy efficiency → warranty → installation needs

4. SEARCH & COMPARE WITH REAL DATA
   - ALWAYS use searchProducts tool with collected info
   - Never invent products, prices, or specs
   - If budget is ₹5,000 and all products are ₹8,000+, be honest: "I found gaming headphones but they're mostly above ₹5,000. Want to see them anyway?"
   - Format prices clearly. Always mention stock.

5. NATURAL NEGOTIATION & INTEREST CREATION
   - If user likes a product but wants a lower price, use tool: requestNegotiation or submitBuyerOffer
   - Explain honestly: "I can reach out to the merchant. They usually negotiate on bulk orders."
   - If user wants to express interest, suggest: "Should I create a buyer interest? That way merchants see exactly what you need."

6. EMAIL CONSENT — ASK NATURALLY, NOT FORCED
   - Only ask about email when relevant (after expressing interest, before creating an offer)
   - Example: "I can email you when a merchant responds to your interest. Would you like that?"
   - Don't ask at the start unless user asks
   - Respect their choice — if they say no, never nag

7. CONVERSATION FORMAT
   - Keep responses SHORT and NATURAL
   - No robotic language, no bullet lists unless user asks
   - Show product recommendations as: "Product name (₹price, X in stock) — why it matches"
   - When recommending next action: "Want me to create a buyer interest?" not "NEXT STEPS: 1. Create interest..."

8. EXAMPLES OF GOOD FOLLOW-UPS:
   ❌ "What is your budget? What brand? How many units? New or used? When do you need it?"
   ✅ "What's your budget for these?"

   ❌ "Tell me your location, delivery timeframe, size, color, and warranty preference"
   ✅ "Where should it be delivered? Any rush?"

   ❌ "Do you want to negotiate this price? Should I save this? Do you want emails?"
   ✅ "This is ₹4,500. Want me to reach out to the merchant and ask for ₹4,000?"

RESPONSE FORMAT:
- Natural response (1-2 sentences or short paragraph)
- One follow-up question (if needed)
- Suggested action if appropriate (if you have enough info to act)
`;

const MAX_TOOL_LOOPS = 8;

// Tools a buyer is allowed to call. Used both to scope what Groq is offered and
// to re-check every tool call that comes back.
const BUYER_TOOLS = [
  "searchProducts",
  "getProducts",
  "getRecommendations",
  "compareProducts",
  "getNegotiationPolicy",
  "requestNegotiation",
  "submitBuyerOffer",
  "updateShoppingSession",
];

function toolsForMessage(role: "MERCHANT" | "BUYER", message: string) {
  const text = message.toLowerCase();
  if (role === "BUYER") {
    // These are the tools needed for a conversational shopping experience.
    return aiTools.filter((tool) => BUYER_TOOLS.includes(tool.function.name));
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
  history?: AiMessage[];
  systemPromptOverride?: string;
}): Promise<{ provider: string; model: string; content: string; toolActivity: string[] }> {
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

  const systemPrompt = input.systemPromptOverride || (input.role === "MERCHANT" ? MERCHANT_SYSTEM : BUYER_SYSTEM);

  const messages: AiMessage[] = [
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
    const { message } = await groqChat(messages, tools);

    // No tool calls → final response
    if (!message.tool_calls?.length) {
      return { provider: "groq", model: groqConfig.model, content: message.content, toolActivity };
    }

    // Process tool calls
    messages.push(message);

    for (const call of message.tool_calls) {
      const toolName = call.function.name;

      // Permission check: buyers can only use shopping tools
      if (input.role === "BUYER" && !BUYER_TOOLS.includes(toolName)) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: `Tool ${toolName} is not available as a buyer.` }),
        });
        toolActivity.push(`${toolName} (denied)`);
        continue;
      }

      toolActivity.push(toolName);

      try {
        const result = await executeAiTool(toolName, call.function.arguments, input.role);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: errorMessage }) });
      }
    }
  }

  return {
    provider: "groq",
    model: groqConfig.model,
    content: "I reached the maximum number of analysis steps. Here's what I found so far based on the tools I called. Please ask a more specific question if you need further detail.",
    toolActivity,
  };
}

// ── Safe Fallback (no LLM) ───────────────────────────────────────
// Used when GROQ_API_KEY is missing: real tool data, no generated prose.

const NO_KEY_HINT = "Set GROQ_API_KEY to enable the conversational agent.";

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
        content: `I found ${products.length} product${products.length === 1 ? "" : "s"}: ${products.map((p) => `${p.name} (${p.priceDisplay})`).join(", ")}. ${NO_KEY_HINT}`,
        toolActivity: ["searchProducts"],
      };
    }
    return {
      provider: "deterministic-fallback",
      content: `I could not find products matching that request. ${NO_KEY_HINT}`,
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
    content: `Your store has ${metrics.totalOrders ?? 0} orders, ${metrics.totalCustomers ?? 0} customers, and ${metrics.totalRevenueDisplay ?? "₹0"} in revenue. ${NO_KEY_HINT}`,
    toolActivity: ["getStoreMetrics"],
  };
}

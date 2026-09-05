import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { runAkumaAgent, runSafeFallback } from "@/ai/agents/akuma-agent";
import type { AiMessage } from "@/ai/llm/groq-client";
import { groqConfigured, groqConfig } from "@/ai/llm/model-config";
import { getOrCreateConversation, addMessage, getConversationContext } from "@/lib/conversation";
import { getMerchantMetrics, getTopOpportunitiesToday, getChurnRiskCustomers, getRevenueLeaks, getProductPerformance, getCustomerSegments } from "@/lib/ai-tools";

// Updated system prompt for dual-party fairness
const DUAL_PARTY_SYSTEM = `You are AKUMA, an impartial AI negotiation middleman. Protect the interests of both the Buyer and the Merchant fairly. Aim for win-win outcomes, respecting buyer budget constraints while preserving seller margins.

IDENTITY: You are a warm, approachable, evidence-first negotiator. You speak like a friendly expert the user trusts — natural, encouraging, and human. Never robotic, never stiff, never corporate.

TONE (applies to buyers and merchants alike):
- Greet people back. If someone says "hi", say hi warmly and invite them to tell you what they need. Do NOT answer a greeting with a data dump or a wall of analysis.
- Use plain, everyday language. Short sentences. Contractions are good ("you'll", "here's", "I'd").
- Be encouraging and positive, especially when the news isn't great — lead with what CAN be done.
- Address the person directly as "you". Refer to yourself as "I".
- Match their energy: casual question, casual answer; detailed question, detailed answer.
- Never lecture, never moralize, and never repeat that you are impartial unless it's actually relevant.
- No emojis unless the user uses them first.

CORE LOOP: UNDERSTAND → INVESTIGATE → USE TOOLS → REASON OVER DATA → PROPOSE → EXPLAIN → CHECK POLICY → ASK FOR APPROVAL.

RULES:
1. ALWAYS use tools for factual data. NEVER invent revenue, percentages, customer counts, product names, prices, or stock levels.
2. Balance both parties' interests: respect buyer budgets while preserving merchant margins. Be genuinely helpful to whoever you're talking to without shortchanging the other side.
3. Before proposing any campaign or discount, call checkGuardrails or simulateOffer first. If guardrails reject it, explain why in friendly terms and offer the next best option.
4. Distinguish ANALYSIS (safe) from SIMULATION (safe) from PROPOSAL (creates record) from EXECUTION (requires approval).
5. When recommending, always cite the evidence: co-purchase rate, order count, customer count, revenue figures — from tool results.
6. If data is unavailable, say so warmly — e.g. "I don't have enough data on that yet, but here's what I can tell you." Never hallucinate.
7. Keep responses concise. Don't write essays for simple questions. A greeting deserves one or two friendly sentences, nothing more.
8. Never expose tool names, JSON, or chain-of-thought to the user. Only share insights and recommendations.
9. Remember conversation context. If the user says "that" or "try it", resolve the reference from prior messages.
10. When a discount exceeds policy limits, explain the limit kindly and offer the maximum allowed alternative.

RESPONSE FORMAT: Friendly direct answer → Evidence (only if relevant) → A helpful next step or question.`;

export async function POST(request: Request) {
  console.log("[AKUMA Chat] POST request received");

  try {
    // Check environment
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const isGroqConfigured = groqConfigured();
    console.log(`[AKUMA Chat] GROQ_API_KEY env set: ${hasGroqKey}, groqConfigured(): ${isGroqConfigured}`);
    console.log(`[AKUMA Chat] Groq model: ${groqConfig.model}`);

    // Fail loudly on a missing key instead of quietly serving canned fallback
    // answers, which makes a misconfigured environment look like a broken bot.
    if (!isGroqConfigured) {
      console.error("GROQ_API_KEY is missing from .env.local");
      return NextResponse.json(
        {
          error: {
            code: "AKUMA_AI_OFFLINE",
            message: "AKUMA's AI is not configured: GROQ_API_KEY is missing from .env.local.",
          },
        },
        { status: 503 }
      );
    }

    // Get session
    const session = await getSession();
    if (!session) {
      console.log("[AKUMA Chat] No valid session found");
      return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
    }
    console.log(`[AKUMA Chat] Session authenticated for user: ${session.username}`);

    // Safely parse request body. Different clients have posted different field
    // names over time, so accept message / prompt / query / messages[].
    let body: {
      message?: string;
      prompt?: string;
      query?: string;
      messages?: AiMessage[];
      role?: "MERCHANT" | "BUYER";
      history?: AiMessage[];
      cartItems?: unknown[];
    } | null = null;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[AKUMA Chat] Failed to parse JSON body:", parseError);
      return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid request body." } }, { status: 400 });
    }

    const isAiMessage = (m: unknown): m is AiMessage =>
      !!m && typeof (m as AiMessage).role === "string" && typeof (m as AiMessage).content === "string";

    const postedMessages: AiMessage[] = Array.isArray(body?.messages) ? body.messages.filter(isAiMessage) : [];

    // Last user turn from a messages[] payload, if that's the shape we got.
    const lastPostedUser = [...postedMessages].reverse().find((m) => m.role === "user")?.content;

    const userMessage = (body?.message ?? body?.prompt ?? body?.query ?? lastPostedUser ?? "").trim();

    if (!userMessage) {
      console.log("[AKUMA Chat] Message validation failed: no message/prompt/query/messages[] in body");
      return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Message is required." } }, { status: 400 });
    }

    const role = body?.role === "BUYER" ? "BUYER" : "MERCHANT";
    console.log(`[AKUMA Chat] Message received from ${role}: "${userMessage.substring(0, 50)}..."`);

    // NEGOTIATION DETECTION FOR CONSUMERS
    // Check if consumer wants to negotiate a product price
    if (role === "BUYER") {
      const negotiationPattern = /(?:i want|can i get|i'll take|negotiate|offer|discount|price)\s+(?:this\s+)?(?:the\s+)?(?:product\s+)?(?:for\s+)?₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rupees?|rs\.?|₹)?/i;
      const match = userMessage.match(negotiationPattern);

      // Check for bulk discount requests
      const cartItems = body?.cartItems || [];
      const hasBulkRequest = /bulk|discount|percentage|%|off/i.test(userMessage);

      if ((match || hasBulkRequest) && cartItems.length > 0) {
        try {
          const prisma = getPrisma();
          if (prisma) {
            let proposedPrice = 0;
            let discountPercentage = 0;

            // Calculate bulk discount tier
            const firstItem = cartItems[0];
            const quantity = firstItem.quantity || 1;

            if (quantity >= 10) {
              discountPercentage = 30;
              proposedPrice = Math.round(firstItem.unitPricePaise * 0.7); // 30% off
            } else if (quantity >= 5) {
              discountPercentage = 10;
              proposedPrice = Math.round(firstItem.unitPricePaise * 0.9); // 10% off
            } else if (match) {
              proposedPrice = Math.round(parseFloat(match[1].replace(/,/g, "")) * 100);
            }

            if (proposedPrice > 0) {
              // Create negotiation with quantity
              const negotiation = await prisma.negotiation.create({
                data: {
                  userId: session.userId || session.username,
                  merchantId: firstItem.merchantId || firstItem.merchant?.id,
                  productId: firstItem.productId,
                  quantity: quantity,
                  originalPrice: firstItem.unitPricePaise,
                  requestedPrice: proposedPrice,
                  status: "OPEN",
                },
              });

              console.log(`[AKUMA Chat] Negotiation created: ${negotiation.id} for ${quantity} units`);

              let responseMessage = "";
              if (discountPercentage > 0) {
                const totalOriginal = (firstItem.unitPricePaise * quantity) / 100;
                const totalNegotiated = (proposedPrice * quantity) / 100;
                responseMessage = `Great! I've sent your offer for ${quantity}x ${firstItem.productName} at ₹${(proposedPrice / 100).toLocaleString()}/unit (${discountPercentage}% off). Original total: ₹${totalOriginal.toLocaleString()} → Your offer: ₹${totalNegotiated.toLocaleString()}. The merchant will review and respond soon!`;
              } else {
                const totalOriginal = (firstItem.unitPricePaise * quantity) / 100;
                const totalNegotiated = (proposedPrice * quantity) / 100;
                responseMessage = `Perfect! I've sent your offer for ${quantity}x ${firstItem.productName} at ₹${(proposedPrice / 100).toLocaleString()}/unit. The merchant will review and respond soon!`;
              }

              return NextResponse.json({
                content: responseMessage,
                provider: "akuma-negotiation",
                negotiationId: negotiation.id,
              });
            }
          }
        } catch (error) {
          console.error("[AKUMA Chat] Failed to create bulk negotiation:", error);
        }
      }
    }

    // Safely extract and validate message history. An explicit history wins;
    // otherwise reuse messages[] minus the turn we just pulled out of it.
    const history: AiMessage[] = (
      Array.isArray(body?.history)
        ? body.history.filter(isAiMessage)
        : postedMessages.filter((m) => m.role !== "system" && m.content.trim() !== userMessage)
    ).slice(-12); // Limit to last 12 messages
    console.log(`[AKUMA Chat] Message history: ${history.length} messages`);

    // Get or create persistent conversation
    let conversation = null;
    try {
      conversation = await getOrCreateConversation(session.username, null, role === "MERCHANT" ? "MERCHANT" : "CONSUMER");
      console.log(`[AKUMA Chat] Conversation retrieved/created: ${conversation?.id}`);
    } catch (dbError) {
      console.error("[AKUMA Chat] Failed to get/create conversation:", dbError);
      // The missing-key guard above already returned, so Groq is configured
      // here: answer without conversation persistence rather than falling back.
      console.log("[AKUMA Chat] DB failed but Groq available, attempting agent call without conversation persistence");
      try {
        const result = await runAkumaAgent({
          username: session.username,
          role,
          message: userMessage,
          history,
          systemPromptOverride: DUAL_PARTY_SYSTEM,
        });
        return NextResponse.json(result);
      } catch (agentError) {
        console.error("AKUMA Chat API Error (no conversation):", agentError);
        throw agentError;
      }
    }

    if (!conversation) {
      console.error("[AKUMA Chat] Conversation is null after getOrCreateConversation");
      // Same as above: Groq is known-configured at this point.
      try {
        const result = await runAkumaAgent({
          username: session.username,
          role,
          message: userMessage,
          history,
          systemPromptOverride: DUAL_PARTY_SYSTEM,
        });
        return NextResponse.json(result);
      } catch (agentError) {
        console.error("AKUMA Chat API Error (conversation null):", agentError);
        throw agentError;
      }
    }

    // Add user message to conversation
    try {
      await addMessage(conversation.id, "user", userMessage);
      console.log(`[AKUMA Chat] User message added to conversation ${conversation.id}`);
    } catch (addMsgError) {
      console.error("[AKUMA Chat] Failed to add user message to conversation:", addMsgError);
    }

    // Get conversation context for the LLM
    let conversationHistory: AiMessage[] = [];
    try {
      const persistedHistory = await getConversationContext(conversation.id, 10);
      conversationHistory = persistedHistory.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      console.log(`[AKUMA Chat] Retrieved ${conversationHistory.length} persisted history messages`);
    } catch (historyError) {
      console.error("[AKUMA Chat] Failed to retrieve conversation history:", historyError);
      conversationHistory = history; // Fall back to provided history
    }

    // Merchant-specific: provide real data context
    let merchantContext = "";
    if (role === "MERCHANT") {
      try {
        console.log("[AKUMA Chat] Fetching merchant data...");
        const [metrics, opportunities, churn, leaks, , segments] = await Promise.all([
          getMerchantMetrics("demo"),
          getTopOpportunitiesToday("demo"),
          getChurnRiskCustomers("demo"),
          getRevenueLeaks("demo"),
          getProductPerformance("demo"),
          getCustomerSegments("demo"),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        merchantContext = `
REAL MERCHANT DATA:
- Revenue: ${(metrics.result as any)?.totalRevenue || 0}
- Opportunities: ${Array.isArray(opportunities.result) ? opportunities.result.length : 0}
- Revenue leaks: ${Array.isArray(leaks.result) ? leaks.result.length : 0}
- Churn risk customers: ${Array.isArray(churn.result) ? churn.result.length : 0}
- Customer segments: ${JSON.stringify((segments.result as any))}
`;
        console.log("[AKUMA Chat] Merchant data fetched successfully");
      } catch (dataError) {
        console.error("[AKUMA Chat] Failed to fetch merchant data:", dataError);
        merchantContext = "(Merchant data unavailable)";
      }
    }

    // Defensive only — the guard at the top of this handler already returns a
    // 503 when the key is missing, so this branch should be unreachable.
    if (!isGroqConfigured) {
      console.log("[AKUMA Chat] Groq not configured, using safe fallback");
      const fallbackResult = await runSafeFallback({ role, message: userMessage });
      try {
        await addMessage(conversation.id, "assistant", fallbackResult.content);
      } catch (addAssistantMsgError) {
        console.error("[AKUMA Chat] Failed to add assistant message to conversation:", addAssistantMsgError);
      }
      return NextResponse.json(fallbackResult);
    }

    console.log("[AKUMA Chat] Calling runAkumaAgent with Groq...");
    try {
      const result = await runAkumaAgent({
        username: session.username,
        role,
        message: merchantContext ? `${userMessage}\n\n[MERCHANT DATA: ${merchantContext}]` : userMessage,
        history: conversationHistory,
        systemPromptOverride: DUAL_PARTY_SYSTEM,
      });
      console.log(`[AKUMA Chat] Agent response received, ${result.toolActivity?.length || 0} tools used`);

      try {
        await addMessage(conversation.id, "assistant", result.content, result.toolActivity);
        console.log("[AKUMA Chat] Assistant response added to conversation");
      } catch (addAssistantMsgError) {
        console.error("[AKUMA Chat] Failed to add assistant message to conversation:", addAssistantMsgError);
      }

      return NextResponse.json(result);
    } catch (agentError) {
      console.error("AKUMA Chat API Error (main flow):", agentError);
      throw agentError;
    }
  } catch (error) {
    // Print the raw error so Groq failures (401 bad key, 429 rate limit, model
    // decommissioned) show up in the terminal instead of failing silently.
    console.error("AKUMA Chat Error:", error);

    // Surface the underlying reason to the client too. The old generic message
    // made an invalid key and a rate limit look identical.
    const detail = error instanceof Error ? error.message : String(error);
    const status = typeof (error as { status?: number })?.status === "number" ? (error as { status: number }).status : undefined;
    const code = status === 401 ? "AKUMA_AI_UNAUTHORIZED" : status === 429 ? "AKUMA_AI_RATE_LIMITED" : "AKUMA_AI_ERROR";

    // Users get a human sentence; the raw provider payload stays in `detail`
    // and in the terminal, where it's actually useful for debugging.
    const friendly =
      status === 401
        ? "I can't reach my AI service right now — the API key looks invalid. Once that's sorted I'll be right back."
        : status === 429
          ? "I'm getting a lot of requests at the moment. Give me a few seconds and try again."
          : "Sorry — I couldn't finish that one. Please try again in a moment.";

    return NextResponse.json(
      {
        error: {
          code,
          message: friendly,
          detail,
          status: status ?? null,
        },
      },
      { status: 502 }
    );
  }
}


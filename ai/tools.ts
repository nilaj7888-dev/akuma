import { getPrisma } from "@/lib/db";
import { evaluateGuardrails, type MerchantPolicy } from "@/lib/guardrails";
import type { OllamaTool } from "./llm/ollama-client";

// ── Tool Definitions ─────────────────────────────────────────────
export const aiTools: OllamaTool[] = [
  {
    type: "function",
    function: {
      name: "getStoreMetrics",
      description: "Get aggregate store metrics (total revenue, order count, customer count) from real PostgreSQL data. Use when the merchant asks about their business performance, revenue, sales, or store health. Returns authoritative numbers only.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "getTopProducts",
      description: "Get the top-selling products by order volume from real order data. Use when the merchant asks which products sell the most, which are performing well, or wants product performance analysis.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "Number of top products to return (default 5)" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getCustomerSegments",
      description: "Get customer segment breakdown (VIP, LOYAL, NEW, AT_RISK, DORMANT) with counts. Use when merchant asks about customer behavior, segments, or retention.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "getProductAffinity",
      description: "Analyze which products are frequently purchased together from real order history. Returns cross-sell opportunities with co-purchase rates. Use when the merchant asks about product combinations, cross-sell, or what customers buy together.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "getRevenueTrends",
      description: "Get revenue trends over time (daily aggregates from recent orders). Use when the merchant asks about revenue direction, whether sales are up or down, or trend analysis.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Number of days to look back (default 30)" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getMerchantPolicy",
      description: "Get the merchant's policy settings including max discount percentage, auto-approval settings, negotiation rules. Use before proposing any discount, campaign, or financial action to know the guardrails.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "getProducts",
      description: "Get the full product catalog for the merchant with prices, stock, and categories. Use when you need to reference specific products, check inventory, or list the catalog.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "searchProducts",
      description: "Search the authenticated merchant's active catalog by keyword. Use when a buyer or merchant wants to find specific products. Prices and availability returned are authoritative. Never invent products or prices.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search keyword or the buyer's product request" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulateOffer",
      description: "Simulate the financial impact of a discount offer WITHOUT executing it. Use when the merchant asks 'what if' questions about pricing, or before proposing a campaign. Returns projected revenue impact and guardrail check result. This is safe — no side effects.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID to simulate a discount for" },
          discountPercent: { type: "number", description: "The discount percentage to simulate (e.g. 8 for 8%)" },
        },
        required: ["productId", "discountPercent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeCampaign",
      description: "Propose a campaign (cross-sell, bundle, or discount) for merchant approval. This creates a real opportunity record and checks guardrails. The campaign will NOT execute until the merchant approves it. Use only after analyzing data and simulating the offer.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Campaign title" },
          description: { type: "string", description: "What this campaign does and why" },
          type: { type: "string", description: "CROSS_SELL, UPSELL, BUNDLE, or CAMPAIGN" },
          sourceProductId: { type: "string", description: "The primary product ID" },
          targetProductId: { type: "string", description: "The cross-sell/bundle target product ID" },
          discountPercent: { type: "number", description: "Discount percentage for the offer" },
          expectedRevenue: { type: "number", description: "Expected incremental revenue in paise" },
          targetCustomers: { type: "number", description: "Number of customers to target" },
        },
        required: ["title", "description", "discountPercent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkGuardrails",
      description: "Check whether a proposed action (discount, campaign, transaction) is allowed by merchant policy. Returns allowed/blocked status, risk level, and any violations. Use this to pre-check before proposing.",
      parameters: {
        type: "object",
        properties: {
          actionType: { type: "string", description: "CREATE_BUNDLE, CREATE_DISCOUNT_CAMPAIGN, or CREATE_CHECKOUT_ORDER" },
          discountPercent: { type: "number", description: "Discount percentage" },
          amount: { type: "number", description: "Transaction amount in paise (optional)" },
          budget: { type: "number", description: "Campaign budget in paise (optional)" },
        },
        required: ["actionType", "discountPercent"],
      },
    },
  },
];

// ── Tool Execution ───────────────────────────────────────────────
export async function executeAiTool(
  name: string,
  args: Record<string, unknown>,
  role: "MERCHANT" | "BUYER",
  merchantEmail = "demo@nova-electronics.test"
): Promise<Record<string, unknown>> {
  const prisma = getPrisma();
  if (!prisma) return { error: "Database not connected. I cannot access store data right now." };

  const merchant = await prisma.merchant.findUnique({
    where: { email: merchantEmail },
    include: { policy: true, _count: { select: { orders: true, customers: true, products: true } } },
  });
  if (!merchant) return { error: "Merchant not found." };

  // ── searchProducts ──
  if (name === "searchProducts") {
    const query = typeof args.query === "string" ? args.query.toLowerCase() : "";
    const allProducts = await prisma.product.findMany({
      where: { merchantId: merchant.id, active: true },
      select: { id: true, name: true, category: true, price: true, stock: true, description: true },
    });
    const matches = allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.description ?? "").toLowerCase().includes(query) ||
        query.split(/\s+/).some((word) => p.name.toLowerCase().includes(word) || p.category.toLowerCase().includes(word))
    );
    return {
      products: (matches.length ? matches : allProducts.slice(0, 3)).map(({ id, name, category, price, stock }) => ({
        id,
        name,
        category,
        pricePaise: price,
        priceDisplay: `₹${(price / 100).toLocaleString("en-IN")}`,
        currency: "INR",
        stock,
        available: stock > 0,
      })),
    };
  }

  // ── getStoreMetrics ──
  if (name === "getStoreMetrics") {
    if (role !== "MERCHANT") return { error: "This tool is available to merchants only." };
    const revenueResult = await prisma.order.aggregate({
      where: { merchantId: merchant.id, status: "PAID" },
      _sum: { amount: true },
      _count: true,
    });
    return {
      totalRevenuePaise: revenueResult._sum.amount ?? 0,
      totalRevenueDisplay: `₹${((revenueResult._sum.amount ?? 0) / 100).toLocaleString("en-IN")}`,
      totalOrders: revenueResult._count,
      totalCustomers: merchant._count.customers,
      totalProducts: merchant._count.products,
      currency: "INR",
    };
  }

  // ── getTopProducts ──
  if (name === "getTopProducts") {
    if (role !== "MERCHANT") return { error: "This tool is available to merchants only." };
    const limit = typeof args.limit === "number" ? Math.min(args.limit, 20) : 5;
    const topProducts = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { merchantId: merchant.id, status: "PAID" } },
      _count: { productId: true },
      _sum: { total: true },
      orderBy: { _count: { productId: "desc" } },
      take: limit,
    });
    const productIds = topProducts.map((p) => p.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
    return {
      topProducts: topProducts.map((tp) => ({
        productId: tp.productId,
        name: productMap[tp.productId]?.name ?? "Unknown",
        category: productMap[tp.productId]?.category ?? "",
        unitsSold: tp._count.productId,
        revenuePaise: tp._sum.total ?? 0,
        revenueDisplay: `₹${((tp._sum.total ?? 0) / 100).toLocaleString("en-IN")}`,
        currentStock: productMap[tp.productId]?.stock ?? 0,
      })),
    };
  }

  // ── getCustomerSegments ──
  if (name === "getCustomerSegments") {
    if (role !== "MERCHANT") return { error: "This tool is available to merchants only." };
    const segments = await prisma.customer.groupBy({
      by: ["segment"],
      where: { merchantId: merchant.id },
      _count: true,
    });
    return {
      segments: segments.map((s) => ({ segment: s.segment, count: s._count })),
      totalCustomers: segments.reduce((sum, s) => sum + s._count, 0),
    };
  }

  // ── getProductAffinity ──
  if (name === "getProductAffinity") {
    if (role !== "MERCHANT") return { error: "This tool is available to merchants only." };
    // Compute actual co-purchase rates from order items
    const orders = await prisma.order.findMany({
      where: { merchantId: merchant.id, status: "PAID" },
      select: { id: true, items: { select: { productId: true } } },
    });
    const products = await prisma.product.findMany({
      where: { merchantId: merchant.id },
      select: { id: true, name: true, category: true, price: true },
    });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    // Count co-occurrences
    const pairCounts: Record<string, number> = {};
    const productOrderCounts: Record<string, number> = {};
    for (const order of orders) {
      const pids = order.items.map((i) => i.productId);
      for (const pid of pids) {
        productOrderCounts[pid] = (productOrderCounts[pid] ?? 0) + 1;
      }
      for (let i = 0; i < pids.length; i++) {
        for (let j = i + 1; j < pids.length; j++) {
          const key = [pids[i], pids[j]].sort().join(":");
          pairCounts[key] = (pairCounts[key] ?? 0) + 1;
        }
      }
    }

    const affinities = Object.entries(pairCounts)
      .map(([key, count]) => {
        const [a, b] = key.split(":");
        const baseCount = Math.max(productOrderCounts[a] ?? 1, productOrderCounts[b] ?? 1);
        return {
          sourceProductId: a,
          sourceProductName: productMap[a]?.name ?? "Unknown",
          targetProductId: b,
          targetProductName: productMap[b]?.name ?? "Unknown",
          coPurchaseCount: count,
          coPurchaseRate: Math.round((count / baseCount) * 1000) / 10,
          totalOrdersAnalyzed: orders.length,
        };
      })
      .sort((a, b) => b.coPurchaseCount - a.coPurchaseCount)
      .slice(0, 5);

    return { productAffinities: affinities, totalOrdersAnalyzed: orders.length };
  }

  // ── getRevenueTrends ──
  if (name === "getRevenueTrends") {
    if (role !== "MERCHANT") return { error: "This tool is available to merchants only." };
    const days = typeof args.days === "number" ? Math.min(args.days, 90) : 30;
    const since = new Date(Date.now() - days * 86_400_000);
    const recentOrders = await prisma.order.findMany({
      where: { merchantId: merchant.id, status: "PAID", createdAt: { gte: since } },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    // Aggregate by day
    const daily: Record<string, { revenue: number; orders: number }> = {};
    for (const order of recentOrders) {
      const day = order.createdAt.toISOString().split("T")[0];
      if (!daily[day]) daily[day] = { revenue: 0, orders: 0 };
      daily[day].revenue += order.amount;
      daily[day].orders += 1;
    }
    const trend = Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, revenuePaise: data.revenue, orders: data.orders }));
    const totalRecent = recentOrders.reduce((s, o) => s + o.amount, 0);
    return {
      trendDays: days,
      dailyTrend: trend.slice(-10), // last 10 days for conciseness
      totalRevenuePaise: totalRecent,
      totalRevenueDisplay: `₹${(totalRecent / 100).toLocaleString("en-IN")}`,
      totalOrders: recentOrders.length,
    };
  }

  // ── getMerchantPolicy ──
  if (name === "getMerchantPolicy") {
    if (role !== "MERCHANT") return { error: "This tool is available to merchants only." };
    const policy = merchant.policy;
    if (!policy) return { error: "No policy configured for this merchant." };
    return {
      maxDiscountPercent: policy.maxDiscountPercent,
      maxCampaignBudget: policy.maxCampaignBudget,
      maxSingleTransaction: policy.maxSingleTransaction,
      requireApprovalAbove: policy.requireApprovalAbove,
      minimumMarginPercent: policy.minimumMarginPercent,
      autoApprovalEnabled: policy.autoApprovalEnabled,
      negotiationEnabled: policy.negotiationEnabled,
      crossSellEnabled: policy.crossSellEnabled,
      upsellEnabled: policy.upsellEnabled,
    };
  }

  // ── getProducts ──
  if (name === "getProducts") {
    const products = await prisma.product.findMany({
      where: { merchantId: merchant.id, active: true },
      select: { id: true, name: true, category: true, price: true, cost: true, stock: true },
    });
    return {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        pricePaise: p.price,
        priceDisplay: `₹${(p.price / 100).toLocaleString("en-IN")}`,
        ...(role === "MERCHANT" ? { costPaise: p.cost, marginPercent: Math.round(((p.price - p.cost) / p.price) * 100) } : {}),
        stock: p.stock,
        available: p.stock > 0,
      })),
    };
  }

  // ── simulateOffer ──
  if (name === "simulateOffer") {
    if (role !== "MERCHANT") return { error: "This tool is available to merchants only." };
    const productId = args.productId as string;
    const discountPercent = args.discountPercent as number;
    const product = await prisma.product.findFirst({ where: { id: productId, merchantId: merchant.id } });
    if (!product) return { error: "Product not found." };
    const policy = merchant.policy;
    if (!policy) return { error: "No policy configured." };

    const discountedPrice = Math.round(product.price * (1 - discountPercent / 100));
    const newMargin = Math.round(((discountedPrice - product.cost) / discountedPrice) * 100);
    const guardrailResult = evaluateGuardrails(
      { actionType: "CREATE_DISCOUNT_CAMPAIGN", productIds: [productId], discountPercent, reason: "Simulation" },
      {
        maxDiscountPercent: policy.maxDiscountPercent,
        maxCampaignBudget: policy.maxCampaignBudget,
        maxSingleTransaction: policy.maxSingleTransaction,
        requireApprovalAbove: policy.requireApprovalAbove,
        minimumMarginPercent: policy.minimumMarginPercent,
        allowedActions: policy.allowedActions as string[],
      },
      newMargin
    );
    return {
      simulation: true,
      noSideEffects: true,
      product: product.name,
      originalPricePaise: product.price,
      discountedPricePaise: discountedPrice,
      discountPercent,
      newMarginPercent: newMargin,
      guardrailResult: {
        allowed: guardrailResult.allowed,
        riskLevel: guardrailResult.riskLevel,
        violations: guardrailResult.violations,
        requiresApproval: guardrailResult.requiresApproval,
      },
    };
  }

  // ── checkGuardrails ──
  if (name === "checkGuardrails") {
    const policy = merchant.policy;
    if (!policy) return { error: "No policy configured." };
    const result = evaluateGuardrails(
      {
        actionType: ((args.actionType as string) || "CREATE_DISCOUNT_CAMPAIGN") as "CREATE_BUNDLE" | "CREATE_DISCOUNT_CAMPAIGN" | "CREATE_CHECKOUT_ORDER",
        productIds: ["placeholder"],
        discountPercent: (args.discountPercent as number) ?? 0,
        amount: args.amount as number | undefined,
        budget: args.budget as number | undefined,
        reason: "Guardrail check",
      },
      {
        maxDiscountPercent: policy.maxDiscountPercent,
        maxCampaignBudget: policy.maxCampaignBudget,
        maxSingleTransaction: policy.maxSingleTransaction,
        requireApprovalAbove: policy.requireApprovalAbove,
        minimumMarginPercent: policy.minimumMarginPercent,
        allowedActions: policy.allowedActions as string[],
      }
    );
    return {
      allowed: result.allowed,
      requiresApproval: result.requiresApproval,
      riskLevel: result.riskLevel,
      violations: result.violations,
      explanation: result.explanation,
    };
  }

  // ── proposeCampaign ──
  if (name === "proposeCampaign") {
    if (role !== "MERCHANT") return { error: "This tool is available to merchants only." };
    const policy = merchant.policy;
    if (!policy) return { error: "No policy configured." };

    const requestedDiscount = (args.discountPercent as number) ?? 0;

    // Check guardrails first
    const guardrailResult = evaluateGuardrails(
      {
        actionType: "CREATE_DISCOUNT_CAMPAIGN",
        productIds: [args.sourceProductId as string ?? "unknown", args.targetProductId as string ?? "unknown"].filter(Boolean),
        discountPercent: requestedDiscount,
        reason: (args.description as string) ?? "Campaign proposal",
      },
      {
        maxDiscountPercent: policy.maxDiscountPercent,
        maxCampaignBudget: policy.maxCampaignBudget,
        maxSingleTransaction: policy.maxSingleTransaction,
        requireApprovalAbove: policy.requireApprovalAbove,
        minimumMarginPercent: policy.minimumMarginPercent,
        allowedActions: policy.allowedActions as string[],
      }
    );

    // Audit the proposal
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        actorType: "AI_AGENT",
        action: "CAMPAIGN_PROPOSAL",
        resourceType: "OPPORTUNITY",
        reason: (args.description as string) ?? "",
        policyResult: {
          maxDiscount: policy.maxDiscountPercent,
          requestedDiscount,
          allowed: guardrailResult.allowed,
          riskLevel: guardrailResult.riskLevel,
          violations: guardrailResult.violations,
        },
      },
    });

    if (!guardrailResult.allowed) {
      return {
        status: "GUARDRAIL_REJECTED",
        allowed: false,
        message: `Proposal blocked by merchant policy. ${guardrailResult.violations.join(" ")}`,
        violations: guardrailResult.violations,
        riskLevel: guardrailResult.riskLevel,
      };
    }

    const opp = await prisma.opportunity.create({
      data: {
        merchantId: merchant.id,
        type: ((args.type as string) ?? "CROSS_SELL") as "CROSS_SELL" | "UPSELL" | "BUNDLE" | "CAMPAIGN" | "REACTIVATION",
        title: (args.title as string) ?? "AI Proposed Campaign",
        description: (args.description as string) ?? "",
        confidence: 91,
        expectedRevenue: (args.expectedRevenue as number) ?? 1842000,
        expectedLift: 6,
        riskScore: guardrailResult.riskLevel === "LOW" ? 10 : guardrailResult.riskLevel === "MEDIUM" ? 40 : 70,
        marginImpact: -Math.round(requestedDiscount * 3000),
        status: "APPROVAL_REQUIRED",
        evidence: {
          discount: requestedDiscount,
          sourceProduct: args.sourceProductId ?? null,
          targetProduct: args.targetProductId ?? null,
          targetCustomers: args.targetCustomers ?? null,
        },
      },
    });

    return {
      status: "APPROVAL_REQUIRED",
      allowed: true,
      message: "Campaign proposed successfully. Guardrails passed. Awaiting merchant approval before execution.",
      opportunityId: opp.id,
      riskLevel: guardrailResult.riskLevel,
      requiresApproval: true,
    };
  }

  return { error: `Unknown tool: ${name}. Available tools: ${aiTools.map((t) => t.function.name).join(", ")}` };
}

export function trustedCatalogContext() {
  return [];
}

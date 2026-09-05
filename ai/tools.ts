import { getPrisma } from "@/lib/db";
import { evaluateGuardrails, type MerchantPolicy } from "@/lib/guardrails";
import type { AiTool } from "./llm/groq-client";

// ── Tool Definitions ─────────────────────────────────────────────
export const aiTools: AiTool[] = [
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
  {
    type: "function",
    function: {
      name: "getProductDetails",
      description: "Get detailed information about a specific product including price, stock, merchant, description, and specifications. Use when consumer asks about a specific product.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID" },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compareProducts",
      description: "Compare two or more products side-by-side. Shows price, availability, specifications, and merchant for comparison. Use when consumer asks 'which is better' or wants to compare products.",
      parameters: {
        type: "object",
        properties: {
          productIds: { type: "array", items: { type: "string" }, description: "Array of product IDs to compare" },
        },
        required: ["productIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getRecommendations",
      description: "Get product recommendations based on consumer requirements, budget, quantity, and use case. Uses real catalog data and explains why each product was selected.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Product category or use case" },
          budget: { type: "number", description: "Maximum budget in paise (optional)" },
          quantity: { type: "number", description: "Quantity needed (optional)" },
          preferences: { type: "string", description: "Any additional preferences or constraints" },
        },
        required: ["category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getNegotiationPolicy",
      description: "Get the merchant's negotiation policy for a specific product including whether negotiation is enabled, max discount allowed, and quantity thresholds.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID" },
          quantity: { type: "number", description: "The desired quantity" },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "requestNegotiation",
      description: "Request a price negotiation for a product. The consumer can specify a desired quantity and price. Returns negotiation status and next steps.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID" },
          quantity: { type: "number", description: "Quantity to negotiate for", minimum: 1 },
          requestedPrice: { type: "number", description: "Requested price per unit in paise (optional)" },
        },
        required: ["productId", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submitBuyerOffer",
      description: "Submit a formal buyer offer for a product with price negotiation. Creates negotiation record, notifies merchant via email, and logs audit trail. Use when buyer wants to make an offer or negotiate price.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID" },
          buyerId: { type: "string", description: "The buyer's user ID" },
          offeredPrice: { type: "number", description: "Offered price per unit in paise (must be > 0)", minimum: 1 },
          quantity: { type: "number", description: "Quantity (default 1)", default: 1 },
          buyerLocation: { type: "string", description: "Buyer location/city for merchant reference (optional)" },
        },
        required: ["productId", "buyerId", "offeredPrice"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateShoppingSession",
      description: "Update the consumer's shopping session with gathered requirements (budget, quantity, mode, category, preferences). Use to persist context for the session.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["RETAIL", "BULK"], description: "Shopping mode" },
          budget: { type: "number", description: "Budget in paise" },
          quantity: { type: "number", description: "Quantity needed" },
          requirements: { type: "object", description: "Structured requirements (category, use case, etc.)" },
        },
        required: [],
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

  // For merchants, get merchant data. For buyers, we'll fetch products across all merchants.
  let merchant = null;
  if (role === "MERCHANT") {
    merchant = await prisma.merchant.findUnique({
      where: { email: merchantEmail },
      include: { policy: true, _count: { select: { orders: true, customers: true, products: true } } },
    });
    if (!merchant) return { error: "Merchant not found." };
  }

  // ── searchProducts ── (for BUYER, search ALL merchants' products; for MERCHANT, search own catalog)
  if (name === "searchProducts") {
    const query = typeof args.query === "string" ? args.query.toLowerCase() : "";
    // Buyers see all products from all merchants; merchants see only their own
    const productWhere = role === "BUYER"
      ? { active: true }  // All active products
      : { merchantId: merchant!.id, active: true };
    const allProducts = await prisma.product.findMany({
      where: productWhere,
      select: { id: true, name: true, category: true, price: true, stock: true, description: true, merchant: { select: { name: true } } },
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
    if (role !== "MERCHANT" || !merchant) return { error: "This tool is available to merchants only." };
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
    if (role !== "MERCHANT" || !merchant) return { error: "This tool is available to merchants only." };
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
    if (role !== "MERCHANT" || !merchant) return { error: "This tool is available to merchants only." };
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
    if (role !== "MERCHANT" || !merchant) return { error: "This tool is available to merchants only." };
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
    if (role !== "MERCHANT" || !merchant) return { error: "This tool is available to merchants only." };
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
    if (role !== "MERCHANT" || !merchant) return { error: "This tool is available to merchants only." };
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
    // For buyers, show all products; for merchants, show own catalog
    const productWhere = role === "MERCHANT" && merchant
      ? { merchantId: merchant.id, active: true }
      : { active: true };
    const products = await prisma.product.findMany({
      where: productWhere,
      select: { id: true, name: true, category: true, price: true, cost: true, stock: true, merchant: { select: { name: true } } },
    });
    return {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        pricePaise: p.price,
        priceDisplay: `₹${(p.price / 100).toLocaleString("en-IN")}`,
        ...(role === "MERCHANT" && merchant ? { costPaise: p.cost, marginPercent: Math.round(((p.price - p.cost) / p.price) * 100) } : {}),
        stock: p.stock,
        available: p.stock > 0,
        merchantName: p.merchant.name,
      })),
    };
  }

  // ── simulateOffer ──
  if (name === "simulateOffer") {
    if (role !== "MERCHANT" || !merchant) return { error: "This tool is available to merchants only." };
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
    if (role !== "MERCHANT" || !merchant) return { error: "This tool is available to merchants only." };
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
    if (role !== "MERCHANT" || !merchant) return { error: "This tool is available to merchants only." };
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

  // ── getProductDetails ──
  if (name === "getProductDetails") {
    const productId = args.productId as string;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { merchant: { select: { name: true } } },
    });
    if (!product) return { error: "Product not found." };
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      pricePaise: product.price,
      priceDisplay: `₹${(product.price / 100).toLocaleString("en-IN")}`,
      stock: product.stock,
      available: product.active && product.stock > 0,
      merchantName: product.merchant.name,
    };
  }

  // ── compareProducts ──
  if (name === "compareProducts") {
    const productIds = args.productIds as string[];
    if (!Array.isArray(productIds) || productIds.length < 2) {
      return { error: "Please provide at least 2 product IDs to compare." };
    }
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { merchant: { select: { name: true } } },
    });
    return {
      comparison: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        pricePaise: p.price,
        priceDisplay: `₹${(p.price / 100).toLocaleString("en-IN")}`,
        stock: p.stock,
        available: p.active && p.stock > 0,
        merchantName: p.merchant.name,
      })),
    };
  }

  // ── getRecommendations ──
  if (name === "getRecommendations") {
    const category = (args.category as string)?.toLowerCase() ?? "";
    const budget = args.budget as number | undefined;
    const quantity = (args.quantity as number) ?? 1;

    // Build query conditions based on role
    const whereConditions: any = { active: true };

    // For merchants only, filter by their own products
    if (role === "MERCHANT" && merchant) {
      whereConditions.merchantId = merchant.id;
    }

    // Add category filter if provided
    if (category) {
      whereConditions.OR = [
        { category: { contains: category, mode: "insensitive" } },
        { name: { contains: category, mode: "insensitive" } },
      ];
    }

    // Add budget filter if provided
    if (budget) {
      whereConditions.price = { lte: Math.floor(budget / quantity) };
    }

    const products = await prisma.product.findMany({
      where: whereConditions,
      include: { merchant: { select: { name: true } } },
      take: 5,
      orderBy: { stock: "desc" },
    });

    return {
      recommendations: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        pricePaise: p.price,
        priceDisplay: `₹${(p.price / 100).toLocaleString("en-IN")}`,
        totalForQuantity: p.price * quantity,
        totalDisplay: `₹${((p.price * quantity) / 100).toLocaleString("en-IN")}`,
        stock: p.stock,
        available: p.active && p.stock >= quantity,
        merchantName: p.merchant.name,
        reason: budget && p.price * quantity <= budget ? "Within budget" : "Available in stock",
      })),
      count: products.length,
    };
  }

  // ── getNegotiationPolicy ──
  if (name === "getNegotiationPolicy") {
    const productId = args.productId as string;
    const quantity = (args.quantity as number) ?? 1;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { merchantId: true, price: true, cost: true },
    });
    if (!product) return { error: "Product not found." };

    const policy = await prisma.policy.findUnique({
      where: { merchantId: product.merchantId },
    });

    if (!policy) {
      return { negotiationEnabled: false, message: "Merchant has not configured a policy." };
    }

    const margin = Math.round(((product.price - product.cost) / product.price) * 100);
    const maxDiscount = policy.maxDiscountPercent;
    const minPrice = Math.round(product.price * (1 - maxDiscount / 100));

    return {
      negotiationEnabled: policy.negotiationEnabled,
      currentPricePaise: product.price,
      currentPriceDisplay: `₹${(product.price / 100).toLocaleString("en-IN")}`,
      maxDiscountPercent: maxDiscount,
      minimumPricePaise: minPrice,
      minimumPriceDisplay: `₹${(minPrice / 100).toLocaleString("en-IN")}`,
      totalValuePaise: product.price * quantity,
      totalValueDisplay: `₹${((product.price * quantity) / 100).toLocaleString("en-IN")}`,
      autoApprovalEnabled: policy.autoApprovalEnabled,
      requireApprovalAbove: policy.requireApprovalAbove,
      message: policy.negotiationEnabled
        ? `Negotiation is enabled. Maximum discount: ${maxDiscount}%.`
        : "This merchant does not allow price negotiation.",
    };
  }

  // ── requestNegotiation ──
  if (name === "requestNegotiation") {
    if (role !== "BUYER") return { error: "Only consumers can request negotiation." };
    const productId = args.productId as string;
    const quantity = args.quantity as number;
    const requestedPrice = args.requestedPrice as number | undefined;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, merchantId: true, price: true, stock: true, active: true },
    });

    if (!product) return { error: "Product not found." };
    if (!product.active || product.stock < quantity) {
      return { error: "Product is not available in the requested quantity." };
    }

    const policy = await prisma.policy.findUnique({
      where: { merchantId: product.merchantId },
    });

    if (!policy?.negotiationEnabled) {
      return { error: "This merchant does not allow price negotiation." };
    }

    // Note: In a real system, we'd get userId from the authenticated session
    // For now, we'll return a placeholder that the API layer should fill
    return {
      status: "NEGOTIATION_REQUEST_PREPARED",
      message: "Negotiation request is ready to be submitted via the API.",
      productId,
      quantity,
      originalPricePaise: product.price,
      requestedPricePaise: requestedPrice,
      merchantApprovalRequired: requestedPrice
        ? Math.round((1 - requestedPrice / product.price) * 100) > policy.maxDiscountPercent
        : false,
      nextStep: "Call POST /api/consumer/negotiation to submit this request.",
    };
  }

  // ── submitBuyerOffer ──
  if (name === "submitBuyerOffer") {
    if (role !== "BUYER") return { error: "Only consumers can submit buyer offers." };

    try {
      const productId = args.productId as string;
      const buyerId = args.buyerId as string;
      const offeredPrice = args.offeredPrice as number;
      const quantity = (args.quantity as number) ?? 1;
      const buyerLocation = args.buyerLocation as string | undefined;

      // Validate offered price
      if (offeredPrice <= 0) {
        return { error: "Offered price must be greater than zero." };
      }

      // Fetch product with merchant details
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          merchant: { select: { id: true, email: true, name: true } },
        },
      });

      if (!product) {
        return { error: "Product not found. Please check the product ID." };
      }

      if (!product.active) {
        return { error: "Product is not active." };
      }

      if (product.stock < quantity) {
        return { error: `Only ${product.stock} units available, requested ${quantity}.` };
      }

      if (!product.merchant.email) {
        return { error: "Merchant email not found. Cannot send offer notification." };
      }

      // Check if negotiation is enabled for this merchant
      const policy = await prisma.policy.findUnique({
        where: { merchantId: product.merchant.id },
      });

      if (!policy?.negotiationEnabled) {
        return { error: "This merchant does not allow price negotiation." };
      }

      // Check if discount exceeds merchant policy
      const discountPercent = Math.round((1 - offeredPrice / product.price) * 100);
      if (discountPercent > (policy.maxDiscountPercent || 0)) {
        return {
          error: `Requested discount ${discountPercent}% exceeds merchant maximum of ${policy.maxDiscountPercent}%.`,
          maxAllowedDiscount: policy.maxDiscountPercent,
          currentPrice: product.price,
          minimumPrice: Math.round(product.price * (1 - (policy.maxDiscountPercent || 0) / 100)),
        };
      }

      // Import email helper (dynamic import to avoid circular dependencies in development)
      const { sendOfferNotification } = await import("@/lib/email");

      let negotiationId: string = "";
      let negotiationAuditId: string = "";

      // Execute atomic transaction
      await prisma.$transaction(async (tx) => {
        // a) Create Negotiation record
        const negotiation = await tx.negotiation.create({
          data: {
            userId: buyerId,
            merchantId: product.merchant.id,
            productId,
            quantity,
            originalPrice: product.price,
            requestedPrice: offeredPrice,
            status: "CUSTOMER_OFFER",
            merchantApprovalRequired: discountPercent > (policy.requireApprovalAbove || 0),
          },
        });

        negotiationId = negotiation.id;

        // b) Create NegotiationAudit record
        const audit = await tx.negotiationAudit.create({
          data: {
            negotiationId,
            action: "OFFER_CREATED",
            actor: "BUYER",
            price: offeredPrice,
            metadata: {
              quantity,
              originalPrice: product.price,
              discountPercent,
              buyerId,
              productName: product.name,
              timestamp: new Date().toISOString(),
            },
          },
        });

        negotiationAuditId = audit.id;

        // c) Create BuyerInterest record (optional demand logging)
        await tx.buyerInterest.create({
          data: {
            userId: buyerId,
            merchantId: product.merchant.id,
            productId,
            quantity,
            preferredPrice: offeredPrice,
            status: "OPEN",
            merchantSeen: false,
            notificationPinned: true,
            merchantResponse: null,
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
          },
        });

        // Create notification for merchant
        await tx.notification.create({
          data: {
            merchantId: product.merchant.id,
            type: "BUYER_INTEREST_NEW",
            title: `New Price Offer for ${product.name}`,
            message: `A customer offered ₹${(offeredPrice / 100).toLocaleString("en-IN")} for ${quantity} unit${quantity > 1 ? "s" : ""} of ${product.name}`,
            resourceType: "NEGOTIATION",
            resourceId: negotiationId,
            actionUrl: `/merchant/negotiations/${negotiationId}`,
            metadata: {
              productName: product.name,
              offeredPrice,
              quantity,
              discountPercent,
            },
          },
        });

        // Send email to merchant
        await sendOfferNotification(product.merchant.email, {
          id: negotiationId,
          productId: product.id,
          productName: product.name,
          buyerName: "Buyer",
          offerAmount: offeredPrice,
          originalPrice: product.price,
          message: buyerLocation ? `Location: ${buyerLocation}` : undefined,
        });
      });

      // Return success payload for AI agent
      return {
        success: true,
        negotiationId,
        negotiationAuditId,
        message: "Offer submitted successfully and merchant notified via email.",
        details: {
          productName: product.name,
          merchantName: product.merchant.name,
          originalPrice: product.price,
          offeredPrice,
          quantity,
          discountPercent,
          requiresMerchantApproval: discountPercent > (policy.requireApprovalAbove || 0),
          merchantEmailSent: product.merchant.email,
        },
      };
    } catch (error: any) {
      console.error("Error submitting buyer offer:", error);
      return {
        success: false,
        error: error.message || "Failed to submit offer. Please try again.",
      };
    }
  }

  // ── updateShoppingSession ──
  if (name === "updateShoppingSession") {
    if (role !== "BUYER") return { error: "Only consumers can update shopping session." };
    // Note: This would need userId from authenticated session
    return {
      status: "SESSION_UPDATE_PREPARED",
      message: "Shopping session update is ready.",
      mode: args.mode,
      budget: args.budget,
      quantity: args.quantity,
      requirements: args.requirements,
      nextStep: "Session will be updated via PATCH /api/consumer/cart",
    };
  }

  return { error: `Unknown tool: ${name}. Available tools: ${aiTools.map((t) => t.function.name).join(", ")}` };
}

export function trustedCatalogContext() {
  return [];
}

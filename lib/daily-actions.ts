import { getPrisma } from "@/lib/db";

export interface MerchantAction {
  id: string;
  priority: number;
  category: "ACQUIRE" | "CONVERT" | "EXPAND" | "RETAIN" | "OPTIMIZE" | "FIX";
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  expectedImpact: number; // In rupees
  confidence: number; // 0-100
  estimatedEffort: "QUICK" | "MEDIUM" | "COMPLEX"; // Time to execute
  recommendedAction: string;
  actionLink: string; // Link to dashboard page or campaign builder
}

export async function getTopActionsForToday(merchantId: string, limit = 5): Promise<MerchantAction[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const now = new Date();
    const actions: MerchantAction[] = [];

    // Get policy to check merchant goal
    const policy = await prisma.policy.findUnique({
      where: { merchantId },
    });

    const primaryGoal = policy?.primaryGoal || "INCREASE_REVENUE";

    // ===== CONVERT: New buyer interests (pinned notifications) =====
    const buyerInterests = await prisma.buyerInterest.findMany({
      where: {
        merchantId,
        status: { in: ["OPEN", "REVIEWING"] },
        merchantSeen: false,
      },
      include: {
        product: { select: { name: true, price: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (buyerInterests.length > 0) {
      // Calculate total potential revenue
      const totalPotentialRevenue = buyerInterests.reduce((sum, interest) => {
        const price = interest.preferredPrice || interest.product.price;
        return sum + (price * interest.quantity);
      }, 0);

      actions.push({
        id: "action-buyer-interests",
        priority: 1000 + Math.round(totalPotentialRevenue / 10000), // High priority
        category: "CONVERT",
        title: `${buyerInterests.length} new buyer ${buyerInterests.length === 1 ? "interest" : "interests"} waiting`,
        description: `Real buyers interested in your products. Potential revenue: ₹${Math.round(totalPotentialRevenue / 100).toLocaleString("en-IN")}.`,
        evidence: {
          interestCount: buyerInterests.length,
          potentialRevenue: Math.round(totalPotentialRevenue / 100),
          topProducts: buyerInterests.slice(0, 3).map(i => i.product.name),
        },
        expectedImpact: Math.round(totalPotentialRevenue / 100 * 0.6), // 60% conversion estimate
        confidence: 80,
        estimatedEffort: "QUICK",
        recommendedAction: "Review and respond to buyer interests with counter offers",
        actionLink: "/dashboard/buyer-interests",
      });

      // Auto-pin these notifications in the database
      await prisma.buyerInterest.updateMany({
        where: {
          merchantId,
          status: { in: ["OPEN", "REVIEWING"] },
          merchantSeen: false,
          notificationPinned: false,
        },
        data: {
          notificationPinned: true,
          notificationPinnedAt: now,
        },
      });
    }

    // ===== RETAIN: Churn risk customers =====
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const churnRiskCustomers = await prisma.customer.findMany({
      where: {
        merchantId,
        lifetimeValue: { gt: 50000 },
        orders: { none: { createdAt: { gte: thirtyDaysAgo } } },
      },
      include: {
        orders: {
          where: { status: "PAID" },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    const atRiskValue = churnRiskCustomers.reduce((sum, c) => sum + c.lifetimeValue, 0);
    if (churnRiskCustomers.length > 0) {
      actions.push({
        id: "action-churn",
        priority: Math.round(atRiskValue / 100000),
        category: "RETAIN",
        title: `Reactivate ${churnRiskCustomers.length} high-value customers`,
        description: `${churnRiskCustomers.length} customers worth ₹${Math.round(atRiskValue / 100)} haven't purchased in 30+ days.`,
        evidence: {
          customerCount: churnRiskCustomers.length,
          atRiskValue: Math.round(atRiskValue / 100),
          estimatedMonthlyLoss: Math.round(atRiskValue / 300),
        },
        expectedImpact: Math.round(atRiskValue / 200), // 50% recovery estimate
        confidence: 65,
        estimatedEffort: "QUICK",
        recommendedAction: "Launch win-back campaign with personalized offer",
        actionLink: "/dashboard/churn",
      });
    }

    // ===== OPTIMIZE: Revenue leaks =====
    const products = await prisma.product.findMany({
      where: { merchantId, active: true },
      include: {
        orderItems: { include: { order: true } },
      },
    });

    let maxLeak = 0;
    let leakCount = 0;
    let topLeakProduct = null;

    for (const product of products) {
      const salesCount = product.orderItems.filter((oi) => oi.order.status === "PAID").length;
      if (salesCount === 0 && product.stock > 15) {
        const leak = (product.cost * product.stock) / 100;
        leakCount++;
        if (leak > maxLeak) {
          maxLeak = leak;
          topLeakProduct = product;
        }
      }
    }

    if (leakCount > 0) {
      actions.push({
        id: "action-leak",
        priority: Math.round(maxLeak / 1000),
        category: "FIX",
        title: `Clear ${leakCount} unsold products from inventory`,
        description: `${leakCount} products have no sales but inventory tied up. Top product: ${topLeakProduct?.name} (${topLeakProduct?.stock} units).`,
        evidence: {
          unsoldProducts: leakCount,
          topProduct: topLeakProduct?.name,
          unitsInStock: topLeakProduct?.stock,
          estimatedCapitalTiedUp: Math.round(maxLeak),
        },
        expectedImpact: Math.round(maxLeak * 0.5), // 50% sell-through
        confidence: 55,
        estimatedEffort: "MEDIUM",
        recommendedAction: "Run promotional bundle or clearance campaign",
        actionLink: "/dashboard/revenue-leaks",
      });
    }

    // ===== EXPAND: Cross-sell opportunities =====
    const orders = await prisma.order.findMany({
      where: { merchantId, status: "PAID" },
      include: { items: true },
    });

    const pairMap = new Map<string, number>();
    for (const order of orders) {
      const productIds = order.items.map((i) => i.productId);
      for (let i = 0; i < productIds.length; i++) {
        for (let j = 0; j < productIds.length; j++) {
          if (i !== j) {
            pairMap.set(`${productIds[i]}_${productIds[j]}`, (pairMap.get(`${productIds[i]}_${productIds[j]}`) || 0) + 1);
          }
        }
      }
    }

    let topPair = null;
    let topCount = 0;
    for (const [pair, count] of pairMap) {
      if (count > topCount && count > orders.length * 0.15) {
        topCount = count;
        topPair = pair;
      }
    }

    if (topPair) {
      const [sourceId, targetId] = topPair.split("_");
      const sourceProduct = products.find((p) => p.id === sourceId);
      const targetProduct = products.find((p) => p.id === targetId);

      if (sourceProduct && targetProduct) {
        actions.push({
          id: "action-cross-sell",
          priority: Math.round((targetProduct.price * topCount) / 10000),
          category: "EXPAND",
          title: `Bundle ${sourceProduct.name} with ${targetProduct.name}`,
          description: `${topCount} customers bought both. Create bundle to increase AOV.`,
          evidence: {
            coPurchaseCount: topCount,
            coPurchaseRate: Math.round((topCount / orders.length) * 100),
            sourceProduct: sourceProduct.name,
            targetProduct: targetProduct.name,
          },
          expectedImpact: Math.round((targetProduct.price * topCount) / 100 * 0.3),
          confidence: 70,
          estimatedEffort: "QUICK",
          recommendedAction: "Create post-purchase offer or product bundle",
          actionLink: "/dashboard/opportunities",
        });
      }
    }

    // ===== ACQUIRE: New customer targeting =====
    const customers = await prisma.customer.findMany({
      where: { merchantId },
      include: { orders: { where: { status: "PAID" } } },
    });

    const highValueCount = customers.filter((c) => c.lifetimeValue > 75000).length;
    if (highValueCount > 0) {
      const avgValue = customers
        .filter((c) => c.lifetimeValue > 75000)
        .reduce((sum, c) => sum + c.lifetimeValue, 0) / highValueCount;

      actions.push({
        id: "action-acquire",
        priority: Math.round(avgValue / 50000),
        category: "ACQUIRE",
        title: `Target lookalike audiences for high-value customers`,
        description: `${highValueCount} high-value customers (avg ₹${Math.round(avgValue / 100)} LTV). Scale acquisition with similar profiles.`,
        evidence: {
          highValueCustomers: highValueCount,
          avgLifetimeValue: Math.round(avgValue / 100),
          potentialNewCustomers: highValueCount * 3,
        },
        expectedImpact: Math.round((avgValue * highValueCount * 0.3) / 100),
        confidence: 60,
        estimatedEffort: "COMPLEX",
        recommendedAction: "Set up lookalike audience campaign",
        actionLink: "/dashboard/acquisition",
      });
    }

    // Sort by priority
    actions.sort((a, b) => b.priority - a.priority);

    // Prioritize based on merchant goal
    if (primaryGoal === "IMPROVE_PROFIT") {
      // Boost profit-related actions
      actions.forEach((a) => {
        if (a.category === "OPTIMIZE" || a.category === "EXPAND") a.priority *= 1.3;
      });
    } else if (primaryGoal === "ACQUIRE_CUSTOMERS") {
      // Boost acquisition
      actions.forEach((a) => {
        if (a.category === "ACQUIRE") a.priority *= 1.3;
      });
    } else if (primaryGoal === "RETAIN_CUSTOMERS") {
      // Boost retention
      actions.forEach((a) => {
        if (a.category === "RETAIN") a.priority *= 1.3;
      });
    }

    // Re-sort after goal weighting
    actions.sort((a, b) => b.priority - a.priority);

    return actions.slice(0, limit);
  } catch {
    return [];
  }
}

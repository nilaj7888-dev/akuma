import { getPrisma } from "@/lib/db";

export type OpportunityType = "CROSS_SELL" | "UPSELL" | "BUNDLE" | "REACTIVATION" | "CHURN_RISK" | "REVENUE_LEAK" | "PRICE_OPTIMIZATION";

export interface OpportunityEvidence {
  metric: string;
  value: number;
  trend?: "up" | "down";
  window: string;
  comparison?: string;
}

export async function detectCrossSellOpportunities(merchantId: string) {
  const prisma = getPrisma();
  if (!prisma) return [];

  // Find product pairs that sell together frequently
  const orderItems = await prisma.orderItem.findMany({
    where: { order: { merchantId } },
    include: { order: { select: { id: true } }, product: { select: { id: true, name: true, price: true, cost: true } } },
  });

  const orderMap = new Map<string, string[]>();
  for (const item of orderItems) {
    const products = orderMap.get(item.orderId) || [];
    products.push(item.productId);
    orderMap.set(item.orderId, products);
  }

  // Calculate co-purchase rates
  const pairs = new Map<string, { count: number; totalOrders: number; sourceProduct: string; targetProduct: string; sourceName: string; targetName: string; sourcePrice: number; targetPrice: number; targetCost: number }>();
  for (const products of orderMap.values()) {
    for (let i = 0; i < products.length; i++) {
      for (let j = 0; j < products.length; j++) {
        if (i !== j) {
          const key = `${products[i]}_${products[j]}`;
          const existing = pairs.get(key) || { count: 0, totalOrders: orderMap.size, sourceProduct: products[i], targetProduct: products[j], sourceName: "", targetName: "", sourcePrice: 0, targetPrice: 0, targetCost: 0 };
          existing.count++;
          pairs.set(key, existing);
        }
      }
    }
  }

  // Get product details and filter high-confidence pairs
  const products = await prisma.product.findMany({ where: { merchantId } });
  const productMap = new Map(products.map(p => [p.id, p]));

  const opportunities = [];
  for (const pair of pairs.values()) {
    const coPurchaseRate = (pair.count / pair.totalOrders) * 100;
    if (coPurchaseRate > 20) { // Only pairs with >20% co-purchase rate
      const sourceProduct = productMap.get(pair.sourceProduct);
      const targetProduct = productMap.get(pair.targetProduct);
      if (sourceProduct && targetProduct && sourceProduct.price > targetProduct.price) {
        // Source product is more expensive, target is add-on
        const expectedRevenue = (targetProduct.price * (pair.count / 100)) | 0;
        const margin = targetProduct.price - targetProduct.cost;
        opportunities.push({
          type: "CROSS_SELL",
          title: `${sourceProduct.name} → ${targetProduct.name}`,
          description: `Customers who buy ${sourceProduct.name} often purchase ${targetProduct.name}. Create a bundle or post-purchase upsell.`,
          sourceProducts: [pair.sourceProduct],
          targetProduct: pair.targetProduct,
          confidence: Math.min(91, Math.round(coPurchaseRate * 2)), // 20%+ → 40-91% confidence
          expectedRevenue,
          expectedLift: Math.round(coPurchaseRate / 2), // Estimated conversion lift
          riskScore: 18,
          marginImpact: margin,
          evidence: {
            coPurchaseRate: Math.round(coPurchaseRate * 10) / 10,
            orders: pair.count,
            customers: pair.count, // Simplified
            window: "last 90 days",
          },
        });
      }
    }
  }

  return opportunities.sort((a, b) => b.expectedRevenue - a.expectedRevenue);
}

export async function detectChurnRisk(merchantId: string) {
  const prisma = getPrisma();
  if (!prisma) return [];

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Get customers with high lifetime value but recent inactivity
  const customers = await prisma.customer.findMany({
    where: { merchantId, lifetimeValue: { gt: 5000 } }, // High-value customers
    include: { orders: { where: { createdAt: { gte: sixtyDaysAgo } }, select: { createdAt: true, amount: true } } },
  });

  const opportunities = [];
  for (const customer of customers) {
    const recentOrders = customer.orders.filter(o => o.createdAt >= thirtyDaysAgo);
    const previousOrders = customer.orders.filter(o => o.createdAt < thirtyDaysAgo && o.createdAt >= sixtyDaysAgo);

    // Detect declining activity
    if (previousOrders.length > 0 && recentOrders.length === 0) {
      const previousSpend = previousOrders.reduce((sum, o) => sum + o.amount, 0);
      const avgOrderValue = previousSpend / previousOrders.length;

      opportunities.push({
        type: "REACTIVATION" as OpportunityType,
        title: `Win back ${customer.name || "customer"}`,
        description: `${customer.name || "This customer"} spent ₹${Math.round(customer.lifetimeValue / 100)} with you but hasn't purchased in 30 days. Target with a special offer.`,
        sourceProducts: [],
        targetProduct: "",
        confidence: 75,
        expectedRevenue: Math.round(avgOrderValue * 1.2), // Expected to spend 20% more than average
        expectedLift: 40, // 40% chance to reactivate
        riskScore: 25,
        marginImpact: 0,
        evidence: {
          lifetimeValue: customer.lifetimeValue / 100,
          lastPurchase: Math.round((now.getTime() - customer.orders[customer.orders.length - 1]?.createdAt.getTime()) / (24 * 60 * 60 * 1000)) || 0,
          purchaseFrequency: `${previousOrders.length} orders in last 60 days`,
          window: "30 days no activity",
        },
      });
    }
  }

  return opportunities;
}

export async function detectRevenueLeak(merchantId: string) {
  const prisma = getPrisma();
  if (!prisma) return [];

  const opportunities = [];

  // 1. Detect low-conversion products
  const products = await prisma.product.findMany({
    where: { merchantId, active: true },
    include: { orderItems: { include: { order: { select: { status: true } } } } },
  });

  for (const product of products) {
    if (product.orderItems.length === 0 && product.stock > 10) {
      opportunities.push({
        type: "REVENUE_LEAK" as OpportunityType,
        title: `${product.name} is not selling`,
        description: `${product.name} has ${product.stock} in stock but zero sales. Consider a promotion, price reduction, or bundling.`,
        sourceProducts: [],
        targetProduct: product.id,
        confidence: 60,
        expectedRevenue: Math.round((product.price * 5)), // Estimated 5 units
        expectedLift: 150, // Need 150% lift to move inventory
        riskScore: 10,
        marginImpact: product.price - product.cost,
        evidence: {
          stockLevel: product.stock,
          salesCount: 0,
          daysInInventory: "unknown",
          window: "all time",
        },
      });
    }
  }

  // 2. Detect high-discount products (erosion of margin)
  const orders = await prisma.order.findMany({
    where: { merchantId, status: "PAID" },
    include: { items: { include: { product: true } } },
  });

  const productMetrics = new Map<string, { totalRevenue: number; totalCost: number; count: number; name: string }>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.productId;
      const existing = productMetrics.get(key) || { totalRevenue: 0, totalCost: 0, count: 0, name: item.product.name };
      existing.totalRevenue += item.total;
      existing.totalCost += item.product.cost * item.quantity;
      existing.count += item.quantity;
      productMetrics.set(key, existing);
    }
  }

  for (const [productId, metrics] of productMetrics) {
    const avgMargin = (metrics.totalRevenue - metrics.totalCost) / metrics.totalRevenue;
    if (avgMargin < 0.2 && metrics.count > 5) {
      // Margin under 20% and sold multiple times
      opportunities.push({
        type: "PRICE_OPTIMIZATION" as OpportunityType,
        title: `${metrics.name} has low margin`,
        description: `${metrics.name} is selling but margin is only ${Math.round(avgMargin * 100)}%. Increase price or reduce discounts.`,
        sourceProducts: [],
        targetProduct: productId,
        confidence: 70,
        expectedRevenue: Math.round((metrics.totalRevenue / metrics.count) * 0.15), // 15% price increase potential
        expectedLift: 8, // Might lose 8% volume but gain margin
        riskScore: 35,
        marginImpact: Math.round((metrics.totalRevenue / metrics.count) * 0.15),
        evidence: {
          currentMargin: `${Math.round(avgMargin * 100)}%`,
          unitsSold: metrics.count,
          totalRevenue: Math.round(metrics.totalRevenue / 100),
          window: "last 90 days",
        },
      });
    }
  }

  return opportunities;
}

export async function getTopOpportunities(merchantId: string, limit = 5) {
  const [crossSell, churn, leak] = await Promise.all([
    detectCrossSellOpportunities(merchantId),
    detectChurnRisk(merchantId),
    detectRevenueLeak(merchantId),
  ]);

  // Combine and rank by expected revenue impact
  const all = [...crossSell, ...churn, ...leak]
    .map(opp => ({
      ...opp,
      score: (opp.expectedRevenue * (opp.confidence / 100)) - (opp.riskScore * 100),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return all;
}

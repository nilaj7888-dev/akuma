import { getPrisma } from "@/lib/db";

export interface MerchantOpportunity {
  id?: string;
  type: string;
  title: string;
  description: string;
  targetAudience?: string;
  expectedRevenue: number;
  confidence: number;
  riskScore: number;
  marginImpact: number;
  expectedLift: number;
  evidence: Record<string, unknown>;
  recommendedAction: string;
  priority: number;
}

async function detectAllOpportunities(merchantId: string): Promise<MerchantOpportunity[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const [merchant, orders, products, customers] = await Promise.all([
      prisma.merchant.findUnique({ where: { id: merchantId } }),
      prisma.order.findMany({
        where: { merchantId },
        include: { items: { include: { product: true } } },
      }),
      prisma.product.findMany({ where: { merchantId, active: true } }),
      prisma.customer.findMany({ where: { merchantId } }),
    ]);

    if (!merchant) return [];

    const opportunities: MerchantOpportunity[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. CROSS-SELL: High co-purchase pairs
    const orderMap = new Map<string, string[]>();
    for (const order of orders) {
      const productIds = order.items.map(i => i.productId);
      orderMap.set(order.id, productIds);
    }

    const pairCounts = new Map<string, { count: number; source?: { id: string; name: string; price: number }; target?: { id: string; name: string; price: number; cost: number } }>();
    for (const productIds of orderMap.values()) {
      for (let i = 0; i < productIds.length; i++) {
        for (let j = 0; j < productIds.length; j++) {
          if (i !== j) {
            const key = `${productIds[i]}_${productIds[j]}`;
            pairCounts.set(key, { count: (pairCounts.get(key)?.count ?? 0) + 1 });
          }
        }
      }
    }

    for (const [pair, data] of pairCounts) {
      const [sourceId, targetId] = pair.split('_');
      const source = products.find(p => p.id === sourceId);
      const target = products.find(p => p.id === targetId);

      if (source && target && source.price > target.price && data.count > 1) {
        const rate = (data.count / Math.max(orders.length, 1)) * 100;
        if (rate > 15) {
          const margin = target.price - target.cost;
          opportunities.push({
            type: "CROSS_SELL",
            title: `Bundle ${source.name} with ${target.name}`,
            description: `${data.count} customers buying ${source.name} also purchased ${target.name}. Create a post-purchase offer.`,
            expectedRevenue: Math.round(target.price * data.count),
            confidence: Math.min(90, 40 + rate),
            riskScore: 15,
            marginImpact: margin,
            expectedLift: Math.round(rate / 2),
            evidence: {
              coPurchaseRate: Math.round(rate * 10) / 10,
              historicalPairs: data.count,
              totalOrders: orders.length,
              window: "all-time",
            },
            recommendedAction: `Create a ${Math.round(margin * 0.1)}₹ discount bundle`,
            priority: Math.round((target.price * data.count) / 1000),
          });
        }
      }
    }

    // 2. CHURN RISK: High-value customers inactive >30 days
    const customerOrderMap = new Map<string, typeof orders>();
    for (const order of orders) {
      if (!order.customerId) continue; // Skip orders without customer
      if (!customerOrderMap.has(order.customerId)) {
        customerOrderMap.set(order.customerId, []);
      }
      const customerOrders = customerOrderMap.get(order.customerId);
      if (customerOrders) {
        customerOrders.push(order);
      }
    }

    for (const customer of customers) {
      if (customer.lifetimeValue > 50000) {
        const custOrders = customerOrderMap.get(customer.id) || [];
        const recentOrders = custOrders.filter(o => o.createdAt >= thirtyDaysAgo);
        if (recentOrders.length === 0 && custOrders.length > 0) {
          const avgOrderValue = custOrders.reduce((s, o) => s + o.amount, 0) / custOrders.length;
          const lastOrder = custOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
          if (lastOrder) {
            opportunities.push({
              type: "REACTIVATION",
              title: `Win back ${customer.name || "VIP customer"}`,
              description: `${customer.name || "This customer"} spent ₹${Math.round(customer.lifetimeValue / 100)} but hasn't ordered in 30+ days.`,
              expectedRevenue: Math.round(avgOrderValue * 1.2),
              confidence: 65,
              riskScore: 30,
              marginImpact: 0,
              expectedLift: 35,
              evidence: {
                daysSinceLastOrder: Math.round((now.getTime() - lastOrder.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
                lifetimeValue: Math.round(customer.lifetimeValue / 100),
                estimatedAOV: Math.round(avgOrderValue / 100),
                totalOrders: custOrders.length,
              },
              recommendedAction: "Send personalized offer or product recommendation",
              priority: Math.round(customer.lifetimeValue / 10000),
            });
          }
        }
      }
    }

    // 3. REVENUE LEAK: Unsold inventory
    const productSalesMap = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        productSalesMap.set(item.productId, (productSalesMap.get(item.productId) ?? 0) + 1);
      }
    }

    for (const product of products) {
      if (product.stock > 20 && !productSalesMap.has(product.id)) {
        opportunities.push({
          type: "REVENUE_LEAK",
          title: `Sell ${product.name} (${product.stock} units)`,
          description: `${product.name} has ${product.stock} in stock with zero sales. Promote or bundle to move inventory.`,
          expectedRevenue: Math.round(product.price * 5),
          confidence: 40,
          riskScore: 10,
          marginImpact: product.price - product.cost,
          expectedLift: 200,
          evidence: {
            unitsInStock: product.stock,
            salesCount: 0,
            potentialRevenue: Math.round((product.price * product.stock) / 100),
            unitCost: Math.round(product.cost / 100),
          },
          recommendedAction: `Run 10-15% discount to clear inventory`,
          priority: product.stock * 10,
        });
      }
    }

    // 4. LOW MARGIN: Products with margin < 20%
    const productMetrics = new Map<string, { revenue: number; cost: number; units: number; name: string }>();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId;
        const existing = productMetrics.get(key) || { revenue: 0, cost: 0, units: 0, name: item.product.name };
        existing.revenue += item.total;
        existing.cost += item.product.cost * item.quantity;
        existing.units += item.quantity;
        productMetrics.set(key, existing);
      }
    }

    for (const [, metrics] of productMetrics) {
      if (metrics.units > 5) {
        const margin = ((metrics.revenue - metrics.cost) / metrics.revenue) * 100;
        if (margin < 20) {
          opportunities.push({
            type: "PRICE_OPTIMIZATION",
            title: `Improve margin on ${metrics.name}`,
            description: `${metrics.name} margin is ${Math.round(margin)}%. A 10% price increase could boost margin without major volume loss.`,
            expectedRevenue: Math.round((metrics.revenue / metrics.units) * 0.1),
            confidence: 55,
            riskScore: 40,
            marginImpact: Math.round((metrics.revenue / metrics.units) * 0.1),
            expectedLift: -8,
            evidence: {
              currentMargin: Math.round(margin),
              unitsSold: metrics.units,
              totalRevenue: Math.round(metrics.revenue / 100),
              avgPrice: Math.round((metrics.revenue / metrics.units) / 100),
            },
            recommendedAction: `Increase price by 10%`,
            priority: Math.round((metrics.revenue * margin) / 100000),
          });
        }
      }
    }

    // Sort by priority score
    opportunities.sort((a, b) => {
      const scoreA = (a.expectedRevenue * (a.confidence / 100)) - (a.riskScore * 100);
      const scoreB = (b.expectedRevenue * (b.confidence / 100)) - (b.riskScore * 100);
      return scoreB - scoreA;
    });

    return opportunities;
  } catch {
    return [];
  }
}

export async function getTopRecommendation(merchantId: string): Promise<MerchantOpportunity | null> {
  const opportunities = await detectAllOpportunities(merchantId);
  return opportunities[0] || null;
}

export async function getAllRecommendations(merchantId: string, limit = 5): Promise<MerchantOpportunity[]> {
  const opportunities = await detectAllOpportunities(merchantId);
  return opportunities.slice(0, limit);
}

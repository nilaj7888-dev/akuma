import { getPrisma } from "@/lib/db";

export interface RevenueLeak {
  id: string;
  type: "UNSOLD_INVENTORY" | "LOW_MARGIN_PRODUCT" | "INACTIVE_CUSTOMER" | "DECLINING_SALES" | "EXCESS_DISCOUNTING";
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  estimatedLossAmount: number;
  evidence: Record<string, unknown>;
  recommendedAction: string;
  actionPriority: number;
}

export async function identifyRevenueLeaks(merchantId: string): Promise<RevenueLeak[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const leaks: RevenueLeak[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Get all products with order data
    const products = await prisma.product.findMany({
      where: { merchantId, active: true },
      include: {
        orderItems: {
          include: { order: true },
        },
      },
    });

    // 1. UNSOLD INVENTORY: Products with stock but zero sales
    for (const product of products) {
      const salesData = product.orderItems.filter((oi) => oi.order.status === "PAID");
      if (salesData.length === 0 && product.stock > 10) {
        const potentialRevenue = Math.round((product.price * product.stock) / 100);
        leaks.push({
          id: `leak-unsold-${product.id}`,
          type: "UNSOLD_INVENTORY",
          title: `Unsold inventory: ${product.name}`,
          description: `${product.name} has ${product.stock} units in stock with zero sales. Tied-up capital and warehouse cost.`,
          severity: product.stock > 30 ? "CRITICAL" : "HIGH",
          estimatedLossAmount: Math.round((product.cost * product.stock) / 100),
          evidence: {
            productName: product.name,
            unitsInStock: product.stock,
            unitCost: Math.round(product.cost / 100),
            totalCost: Math.round((product.cost * product.stock) / 100),
            daysInStock: "unknown",
          },
          recommendedAction: "Run promotional campaign or bundle with fast-moving products",
          actionPriority: product.stock * 2,
        });
      }
    }

    // 2. LOW MARGIN PRODUCTS: Margin < 20% with volume
    const productMetrics = new Map<string, { revenue: number; cost: number; units: number; name: string }>();
    for (const product of products) {
      const salesData = product.orderItems.filter((oi) => oi.order.status === "PAID" && oi.order.createdAt >= ninetyDaysAgo);
      if (salesData.length > 0) {
        const revenue = salesData.reduce((sum, oi) => sum + oi.total, 0);
        const cost = salesData.reduce((sum, oi) => sum + product.cost * oi.quantity, 0);
        const units = salesData.reduce((sum, oi) => sum + oi.quantity, 0);
        productMetrics.set(product.id, { revenue, cost, units, name: product.name });
      }
    }

    for (const [productId, metrics] of productMetrics) {
      if (metrics.units > 5) {
        const margin = ((metrics.revenue - metrics.cost) / metrics.revenue) * 100;
        if (margin < 20) {
          const lossPerUnit = (metrics.cost - (metrics.revenue / metrics.units)) / metrics.units;
          leaks.push({
            id: `leak-margin-${productId}`,
            type: "LOW_MARGIN_PRODUCT",
            title: `Low margin: ${metrics.name}`,
            description: `${metrics.name} has only ${Math.round(margin)}% margin. Losing money per sale or cutting profits.`,
            severity: margin < 10 ? "CRITICAL" : "HIGH",
            estimatedLossAmount: Math.round(Math.abs(lossPerUnit * metrics.units) / 100),
            evidence: {
              productName: metrics.name,
              currentMargin: Math.round(margin),
              unitsSold: metrics.units,
              totalRevenue: Math.round(metrics.revenue / 100),
              totalCost: Math.round(metrics.cost / 100),
            },
            recommendedAction: margin < 10 ? "Increase price by 15-20% immediately" : "Review pricing and discounting strategy",
            actionPriority: Math.round(Math.abs(lossPerUnit * metrics.units) / 1000),
          });
        }
      }
    }

    // 3. INACTIVE CUSTOMERS: High-value customers with 60+ days no purchase
    const customers = await prisma.customer.findMany({
      where: { merchantId, lifetimeValue: { gt: 50000 } },
      include: {
        orders: {
          where: { status: "PAID", createdAt: { gte: ninetyDaysAgo } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    for (const customer of customers) {
      if (customer.orders.length === 0) {
        // No orders in last 90 days
        const daysInactive = Math.round((Date.now() - customer.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
        if (daysInactive > 60) {
          const avgOrderValue = customer.lifetimeValue / Math.max(await prisma.order.count({ where: { customerId: customer.id } }), 1);
          leaks.push({
            id: `leak-inactive-${customer.id}`,
            type: "INACTIVE_CUSTOMER",
            title: `Inactive high-value customer: ${customer.name}`,
            description: `${customer.name} (₹${Math.round(customer.lifetimeValue / 100)} LTV) hasn't purchased in ${daysInactive} days.`,
            severity: daysInactive > 90 ? "CRITICAL" : "HIGH",
            estimatedLossAmount: Math.round(avgOrderValue / 100),
            evidence: {
              customerName: customer.name,
              lifetimeValue: Math.round(customer.lifetimeValue / 100),
              daysInactive,
              estimatedMonthlyLoss: Math.round(avgOrderValue / 3 / 100),
            },
            recommendedAction: "Launch personalized win-back campaign with exclusive offer",
            actionPriority: Math.round(customer.lifetimeValue / 10000),
          });
        }
      }
    }

    // 4. DECLINING SALES: Products with sales drop >30% vs previous period
    // (Simplified: just check products with <5 sales in last 30 days vs >20 sales in first 60 days)
    for (const product of products) {
      const recentSales = product.orderItems.filter(
        (oi) => oi.order.status === "PAID" && oi.order.createdAt >= thirtyDaysAgo
      ).length;
      const previousSales = product.orderItems.filter(
        (oi) => oi.order.status === "PAID" && oi.order.createdAt >= ninetyDaysAgo && oi.order.createdAt < thirtyDaysAgo
      ).length;

      if (previousSales > 10 && recentSales < previousSales * 0.7) {
        const decline = Math.round(((previousSales - recentSales) / previousSales) * 100);
        leaks.push({
          id: `leak-decline-${product.id}`,
          type: "DECLINING_SALES",
          title: `Sales declining: ${product.name}`,
          description: `${product.name} sales dropped ${decline}% in the last 30 days.`,
          severity: decline > 50 ? "CRITICAL" : "HIGH",
          estimatedLossAmount: Math.round((product.price * (previousSales - recentSales)) / 100),
          evidence: {
            productName: product.name,
            previousMonthSales: previousSales,
            currentMonthSales: recentSales,
            declinePercent: decline,
          },
          recommendedAction: "Investigate pricing, competition, or customer feedback. Consider promotion.",
          actionPriority: Math.round((product.price * (previousSales - recentSales)) / 10000),
        });
      }
    }

    // Sort by action priority (estimated loss impact)
    return leaks.sort((a, b) => b.actionPriority - a.actionPriority);
  } catch {
    return [];
  }
}

export interface LeakSummary {
  totalLeaksIdentified: number;
  totalEstimatedLoss: number;
  criticalLeaks: number;
  highRiskLeaks: number;
  leaksByType: Record<string, number>;
}

export async function getLeakSummary(merchantId: string): Promise<LeakSummary> {
  const leaks = await identifyRevenueLeaks(merchantId);

  return {
    totalLeaksIdentified: leaks.length,
    totalEstimatedLoss: Math.round(leaks.reduce((sum, l) => sum + l.estimatedLossAmount, 0)),
    criticalLeaks: leaks.filter((l) => l.severity === "CRITICAL").length,
    highRiskLeaks: leaks.filter((l) => l.severity === "HIGH").length,
    leaksByType: {
      UNSOLD_INVENTORY: leaks.filter((l) => l.type === "UNSOLD_INVENTORY").length,
      LOW_MARGIN_PRODUCT: leaks.filter((l) => l.type === "LOW_MARGIN_PRODUCT").length,
      INACTIVE_CUSTOMER: leaks.filter((l) => l.type === "INACTIVE_CUSTOMER").length,
      DECLINING_SALES: leaks.filter((l) => l.type === "DECLINING_SALES").length,
      EXCESS_DISCOUNTING: leaks.filter((l) => l.type === "EXCESS_DISCOUNTING").length,
    },
  };
}

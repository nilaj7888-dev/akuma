import { getPrisma } from "@/lib/db";
import { getTopOpportunities, detectChurnRisk, detectRevenueLeak } from "@/lib/analytics";

export interface AIToolResult {
  name: string;
  result: unknown;
  error?: string;
}

export async function getMerchantMetrics(merchantId: string): Promise<AIToolResult> {
  const prisma = getPrisma();
  if (!prisma) return { name: "getMerchantMetrics", result: null, error: "Database unavailable" };

  try {
    const [revenue, orders, customers, opportunities, campaigns] = await Promise.all([
      prisma.order.aggregate({ where: { merchantId, status: "PAID" }, _sum: { amount: true } }),
      prisma.order.count({ where: { merchantId } }),
      prisma.customer.count({ where: { merchantId } }),
      prisma.opportunity.count({ where: { merchantId } }),
      prisma.campaign.aggregate({ where: { merchantId }, _sum: { budget: true } }),
    ]);

    return {
      name: "getMerchantMetrics",
      result: {
        totalRevenue: (revenue._sum.amount ?? 0) / 100,
        orders,
        customers,
        opportunities,
        campaignBudget: (campaigns._sum.budget ?? 0) / 100,
      },
    };
  } catch (error) {
    return { name: "getMerchantMetrics", result: null, error: String(error) };
  }
}

export async function getTopOpportunitiesToday(merchantId: string): Promise<AIToolResult> {
  try {
    const opportunities = await getTopOpportunities(merchantId, 5);
    return {
      name: "getTopOpportunitiesToday",
      result: opportunities.map(opp => ({
        title: opp.title,
        type: opp.type,
        description: opp.description,
        expectedRevenue: opp.expectedRevenue / 100,
        confidence: opp.confidence,
        evidence: opp.evidence,
      })),
    };
  } catch (error) {
    return { name: "getTopOpportunitiesToday", result: null, error: String(error) };
  }
}

export async function getChurnRiskCustomers(merchantId: string): Promise<AIToolResult> {
  try {
    const risks = await detectChurnRisk(merchantId);
    return {
      name: "getChurnRiskCustomers",
      result: risks.map(r => ({
        title: r.title,
        description: r.description,
        confidence: r.confidence,
        expectedRevenue: r.expectedRevenue / 100,
      })),
    };
  } catch (error) {
    return { name: "getChurnRiskCustomers", result: null, error: String(error) };
  }
}

export async function getRevenueLeaks(merchantId: string): Promise<AIToolResult> {
  try {
    const leaks = await detectRevenueLeak(merchantId);
    return {
      name: "getRevenueLeaks",
      result: leaks.map(l => ({
        title: l.title,
        description: l.description,
        expectedRevenue: l.expectedRevenue / 100,
        evidence: l.evidence,
      })),
    };
  } catch (error) {
    return { name: "getRevenueLeaks", result: null, error: String(error) };
  }
}

export async function getProductPerformance(merchantId: string): Promise<AIToolResult> {
  const prisma = getPrisma();
  if (!prisma) return { name: "getProductPerformance", result: null, error: "Database unavailable" };

  try {
    const products = await prisma.product.findMany({
      where: { merchantId },
      include: { orderItems: { include: { order: { select: { status: true, amount: true } } } } },
    });

    const performance = products.map(p => {
      const revenue = p.orderItems
        .filter(oi => oi.order.status === "PAID")
        .reduce((sum, oi) => sum + oi.total, 0);
      const units = p.orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
      const margin = ((p.price - p.cost) / p.price) * 100;

      return {
        name: p.name,
        revenue: revenue / 100,
        units,
        stock: p.stock,
        margin: Math.round(margin),
        status: units === 0 ? "NO_SALES" : p.stock < 10 ? "LOW_STOCK" : "ACTIVE",
      };
    });

    return {
      name: "getProductPerformance",
      result: performance.sort((a, b) => b.revenue - a.revenue),
    };
  } catch (error) {
    return { name: "getProductPerformance", result: null, error: String(error) };
  }
}

export async function getCustomerSegments(merchantId: string): Promise<AIToolResult> {
  const prisma = getPrisma();
  if (!prisma) return { name: "getCustomerSegments", result: null, error: "Database unavailable" };

  try {
    const customers = await prisma.customer.findMany({
      where: { merchantId },
      include: { orders: { select: { amount: true } } },
    });

    const segments = {
      vip: customers.filter(c => c.lifetimeValue > 10000),
      loyal: customers.filter(c => c.lifetimeValue >= 5000 && c.lifetimeValue <= 10000),
      active: customers.filter(c => c.lifetimeValue < 5000 && c.orders.length > 0),
      inactive: customers.filter(c => c.orders.length === 0),
    };

    return {
      name: "getCustomerSegments",
      result: {
        vip: { count: segments.vip.length, avgValue: Math.round((segments.vip.reduce((s, c) => s + c.lifetimeValue, 0) / segments.vip.length) / 100) || 0 },
        loyal: { count: segments.loyal.length, avgValue: Math.round((segments.loyal.reduce((s, c) => s + c.lifetimeValue, 0) / segments.loyal.length) / 100) || 0 },
        active: { count: segments.active.length, avgValue: Math.round((segments.active.reduce((s, c) => s + c.lifetimeValue, 0) / segments.active.length) / 100) || 0 },
        inactive: { count: segments.inactive.length },
      },
    };
  } catch (error) {
    return { name: "getCustomerSegments", result: null, error: String(error) };
  }
}

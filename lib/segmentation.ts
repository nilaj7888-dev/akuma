import { getPrisma } from "@/lib/db";

export interface CustomerSegment {
  id: string;
  name: string;
  email: string | null;
  lifetimeValue: number;
  orderCount: number;
  averageOrderValue: number;
  lastOrderDate: Date | null;
  daysSinceLastOrder: number | null;
  segment: "VIP" | "LOYAL" | "ACTIVE" | "INACTIVE" | "AT_RISK";
  segmentReason: string;
}

export interface SegmentSummary {
  segment: "VIP" | "LOYAL" | "ACTIVE" | "INACTIVE" | "AT_RISK";
  count: number;
  totalValue: number;
  averageValue: number;
  revenueContribution: number;
  recommendedAction: string;
}

export async function getCustomerSegments(merchantId: string): Promise<CustomerSegment[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const customers = await prisma.customer.findMany({
      where: { merchantId },
      include: {
        orders: {
          where: { status: "PAID" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const segments: CustomerSegment[] = [];

    for (const customer of customers) {
      let segment: "VIP" | "LOYAL" | "ACTIVE" | "INACTIVE" | "AT_RISK" = "INACTIVE";
      let segmentReason = "";

      const lastOrder = customer.orders[0];
      const daysSinceLastOrder = lastOrder
        ? Math.round((now.getTime() - lastOrder.createdAt.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      const avgOrderValue = customer.orders.length > 0 ? customer.lifetimeValue / customer.orders.length : 0;

      // Segmentation logic
      if (customer.lifetimeValue > 100000) {
        segment = "VIP";
        segmentReason = `Top-tier customer: ₹${Math.round(customer.lifetimeValue / 100)} lifetime value`;
      } else if (customer.lifetimeValue >= 50000 && daysSinceLastOrder && daysSinceLastOrder <= 30) {
        segment = "LOYAL";
        segmentReason = `High-value repeat buyer: ₹${Math.round(customer.lifetimeValue / 100)} with recent order`;
      } else if (customer.orders.length > 0 && daysSinceLastOrder && daysSinceLastOrder <= 30) {
        segment = "ACTIVE";
        segmentReason = `Recent purchaser: ${customer.orders.length} orders`;
      } else if (customer.orders.length > 0 && customer.lifetimeValue > 50000 && daysSinceLastOrder && daysSinceLastOrder > 30) {
        segment = "AT_RISK";
        segmentReason = `High-value at risk: ₹${Math.round(customer.lifetimeValue / 100)} inactive ${daysSinceLastOrder} days`;
      } else if (customer.orders.length === 0) {
        segment = "INACTIVE";
        segmentReason = "No purchase history";
      } else {
        segment = "INACTIVE";
        segmentReason = "Inactive for 30+ days";
      }

      segments.push({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        lifetimeValue: Math.round(customer.lifetimeValue / 100),
        orderCount: customer.orders.length,
        averageOrderValue: Math.round(avgOrderValue / 100),
        lastOrderDate: lastOrder?.createdAt || null,
        daysSinceLastOrder,
        segment,
        segmentReason,
      });
    }

    return segments.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
  } catch {
    return [];
  }
}

export async function getSegmentSummary(merchantId: string): Promise<SegmentSummary[]> {
  const segments = await getCustomerSegments(merchantId);

  const segmentGroups = {
    VIP: segments.filter((s) => s.segment === "VIP"),
    LOYAL: segments.filter((s) => s.segment === "LOYAL"),
    ACTIVE: segments.filter((s) => s.segment === "ACTIVE"),
    AT_RISK: segments.filter((s) => s.segment === "AT_RISK"),
    INACTIVE: segments.filter((s) => s.segment === "INACTIVE"),
  };

  const totalRevenue = segments.reduce((sum, s) => sum + s.lifetimeValue, 0);

  const summary: SegmentSummary[] = [
    {
      segment: "VIP",
      count: segmentGroups.VIP.length,
      totalValue: segmentGroups.VIP.reduce((sum, s) => sum + s.lifetimeValue, 0),
      averageValue: segmentGroups.VIP.length > 0 ? Math.round(segmentGroups.VIP.reduce((sum, s) => sum + s.lifetimeValue, 0) / segmentGroups.VIP.length) : 0,
      revenueContribution: totalRevenue > 0 ? Math.round((segmentGroups.VIP.reduce((sum, s) => sum + s.lifetimeValue, 0) / totalRevenue) * 100) : 0,
      recommendedAction: "VIP retention: exclusive offers, early access, priority support",
    },
    {
      segment: "LOYAL",
      count: segmentGroups.LOYAL.length,
      totalValue: segmentGroups.LOYAL.reduce((sum, s) => sum + s.lifetimeValue, 0),
      averageValue: segmentGroups.LOYAL.length > 0 ? Math.round(segmentGroups.LOYAL.reduce((sum, s) => sum + s.lifetimeValue, 0) / segmentGroups.LOYAL.length) : 0,
      revenueContribution: totalRevenue > 0 ? Math.round((segmentGroups.LOYAL.reduce((sum, s) => sum + s.lifetimeValue, 0) / totalRevenue) * 100) : 0,
      recommendedAction: "Loyalty rewards: referral incentives, bundling, upsell opportunities",
    },
    {
      segment: "ACTIVE",
      count: segmentGroups.ACTIVE.length,
      totalValue: segmentGroups.ACTIVE.reduce((sum, s) => sum + s.lifetimeValue, 0),
      averageValue: segmentGroups.ACTIVE.length > 0 ? Math.round(segmentGroups.ACTIVE.reduce((sum, s) => sum + s.lifetimeValue, 0) / segmentGroups.ACTIVE.length) : 0,
      revenueContribution: totalRevenue > 0 ? Math.round((segmentGroups.ACTIVE.reduce((sum, s) => sum + s.lifetimeValue, 0) / totalRevenue) * 100) : 0,
      recommendedAction: "Engagement: cross-sell, personalized recommendations, loyalty program",
    },
    {
      segment: "AT_RISK",
      count: segmentGroups.AT_RISK.length,
      totalValue: segmentGroups.AT_RISK.reduce((sum, s) => sum + s.lifetimeValue, 0),
      averageValue: segmentGroups.AT_RISK.length > 0 ? Math.round(segmentGroups.AT_RISK.reduce((sum, s) => sum + s.lifetimeValue, 0) / segmentGroups.AT_RISK.length) : 0,
      revenueContribution: totalRevenue > 0 ? Math.round((segmentGroups.AT_RISK.reduce((sum, s) => sum + s.lifetimeValue, 0) / totalRevenue) * 100) : 0,
      recommendedAction: "Win-back: reactivation campaigns, special offers, win-back discount",
    },
    {
      segment: "INACTIVE",
      count: segmentGroups.INACTIVE.length,
      totalValue: segmentGroups.INACTIVE.reduce((sum, s) => sum + s.lifetimeValue, 0),
      averageValue: segmentGroups.INACTIVE.length > 0 ? Math.round(segmentGroups.INACTIVE.reduce((sum, s) => sum + s.lifetimeValue, 0) / segmentGroups.INACTIVE.length) : 0,
      revenueContribution: totalRevenue > 0 ? Math.round((segmentGroups.INACTIVE.reduce((sum, s) => sum + s.lifetimeValue, 0) / totalRevenue) * 100) : 0,
      recommendedAction: "Re-engagement: reminder campaign, product updates, special welcome back offer",
    },
  ];

  return summary.filter((s) => s.count > 0);
}

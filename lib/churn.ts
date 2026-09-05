import { getPrisma } from "@/lib/db";

export interface ChurnRiskCustomer {
  id: string;
  name: string;
  email: string | null;
  lifetimeValue: number;
  lastOrderDate: Date;
  daysSinceLastOrder: number;
  orderCount: number;
  averageOrderValue: number;
  riskScore: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM";
  recommendedAction: string;
}

export async function getChurnRiskCustomers(merchantId: string): Promise<ChurnRiskCustomer[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get all high-value customers with order history
    const customers = await prisma.customer.findMany({
      where: { merchantId, lifetimeValue: { gte: 50000 } },
      include: {
        orders: {
          where: { status: "PAID", createdAt: { gte: sixtyDaysAgo } },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    const atRisk: ChurnRiskCustomer[] = [];

    for (const customer of customers) {
      if (customer.orders.length === 0) continue; // No orders in last 60 days

      const recentOrders = customer.orders.filter(o => o.createdAt >= thirtyDaysAgo);
      const previousOrders = customer.orders.filter(o => o.createdAt < thirtyDaysAgo && o.createdAt >= sixtyDaysAgo);

      // Flag if high-value but recently inactive
      if (previousOrders.length > 0 && recentOrders.length === 0) {
        const lastOrder = customer.orders[0];
        const daysSince = Math.round((now.getTime() - lastOrder.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        const avgOrderValue = customer.lifetimeValue / customer.orders.length;
        const riskScore = Math.min(100, 30 + daysSince / 3); // 30 base + day factor

        let riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" = "MEDIUM";
        if (daysSince > 60) riskLevel = "CRITICAL";
        else if (daysSince > 45) riskLevel = "HIGH";

        atRisk.push({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          lifetimeValue: Math.round(customer.lifetimeValue / 100),
          lastOrderDate: lastOrder.createdAt,
          daysSinceLastOrder: daysSince,
          orderCount: customer.orders.length,
          averageOrderValue: Math.round(avgOrderValue / 100),
          riskScore: Math.round(riskScore),
          riskLevel,
          recommendedAction:
            riskLevel === "CRITICAL"
              ? "Send urgent reactivation offer with 15% discount"
              : riskLevel === "HIGH"
                ? "Send personalized product recommendation"
                : "Send reminder with customer appreciation message",
        });
      }
    }

    // Sort by risk score (highest first)
    return atRisk.sort((a, b) => b.riskScore - a.riskScore);
  } catch {
    return [];
  }
}

export interface WinBackCampaignInput {
  merchantId: string;
  customerIds: string[];
  campaignType: "REMINDER" | "DISCOUNT" | "BUNDLE" | "PRODUCT_REC";
  discountPercent?: number;
  productIds?: string[];
  message?: string;
}

export async function createWinBackCampaign(input: WinBackCampaignInput): Promise<{ id: string; status: string } | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    // Validate merchant policy
    const policy = await prisma.policy.findUnique({ where: { merchantId: input.merchantId } });
    if (!policy) return null;

    if (input.discountPercent && input.discountPercent > policy.maxDiscountPercent) {
      throw new Error(`Discount exceeds policy maximum of ${policy.maxDiscountPercent}%`);
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        merchantId: input.merchantId,
        name: `Win-Back: ${input.campaignType} Campaign`,
        type: input.campaignType,
        audience: { customerIds: input.customerIds },
        discount: input.discountPercent || 0,
        budget: input.customerIds.length * (input.discountPercent || 0) * 100, // Rough estimate
        status: "DRAFT",
        expectedRevenue: input.customerIds.length * 1000, // Conservative estimate
      },
    });

    return { id: campaign.id, status: campaign.status };
  } catch (error) {
    console.error("Failed to create win-back campaign:", error);
    return null;
  }
}

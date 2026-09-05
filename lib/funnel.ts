import { getPrisma } from "@/lib/db";

export interface FunnelStage {
  stage: string;
  count: number;
  dropoff: number;
  conversionRate: number;
}

export interface FunnelAnalysis {
  stages: FunnelStage[];
  overallConversion: number;
  biggestDropoff: { stage: string; dropoff: number };
  recommendations: string[];
}

export async function analyzeConversionFunnel(merchantId: string): Promise<FunnelAnalysis> {
  const prisma = getPrisma();
  if (!prisma) return { stages: [], overallConversion: 0, biggestDropoff: { stage: "", dropoff: 0 }, recommendations: [] };

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all orders in last 30 days
    const orders = await prisma.order.findMany({
      where: {
        merchantId,
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        transaction: true,
        items: true,
      },
    });

    // Get product views (simulated from order items as proxy)
    const products = await prisma.product.findMany({
      where: { merchantId, active: true },
    });

    // Stage 1: Browse (Product catalog views - estimated from product count)
    const browseCount = products.length * 50; // Estimate 50 views per product

    // Stage 2: Add to Cart (Orders created)
    const cartCount = orders.length;

    // Stage 3: Checkout Started (Orders with items)
    const checkoutCount = orders.filter((o) => o.items.length > 0).length;

    // Stage 4: Payment Initiated (Orders with transactions)
    const paymentInitiated = orders.filter((o) => o.transaction).length;

    // Stage 5: Payment Completed (Paid orders)
    const paidCount = orders.filter((o) => o.status === "PAID").length;

    const stages: FunnelStage[] = [
      {
        stage: "Browse Catalog",
        count: browseCount,
        dropoff: 0,
        conversionRate: 100,
      },
      {
        stage: "Add to Cart",
        count: cartCount,
        dropoff: browseCount > 0 ? Math.round(((browseCount - cartCount) / browseCount) * 100) : 0,
        conversionRate: browseCount > 0 ? Math.round((cartCount / browseCount) * 100) : 0,
      },
      {
        stage: "Checkout Started",
        count: checkoutCount,
        dropoff: cartCount > 0 ? Math.round(((cartCount - checkoutCount) / cartCount) * 100) : 0,
        conversionRate: cartCount > 0 ? Math.round((checkoutCount / cartCount) * 100) : 0,
      },
      {
        stage: "Payment Initiated",
        count: paymentInitiated,
        dropoff: checkoutCount > 0 ? Math.round(((checkoutCount - paymentInitiated) / checkoutCount) * 100) : 0,
        conversionRate: checkoutCount > 0 ? Math.round((paymentInitiated / checkoutCount) * 100) : 0,
      },
      {
        stage: "Payment Completed",
        count: paidCount,
        dropoff: paymentInitiated > 0 ? Math.round(((paymentInitiated - paidCount) / paymentInitiated) * 100) : 0,
        conversionRate: paymentInitiated > 0 ? Math.round((paidCount / paymentInitiated) * 100) : 0,
      },
    ];

    const overallConversion = browseCount > 0 ? Math.round((paidCount / browseCount) * 100) : 0;

    // Find biggest dropoff
    let biggestDropoff = { stage: "", dropoff: 0 };
    for (let i = 1; i < stages.length; i++) {
      if (stages[i].dropoff > biggestDropoff.dropoff) {
        biggestDropoff = { stage: stages[i].stage, dropoff: stages[i].dropoff };
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (stages[1].conversionRate < 10) {
      recommendations.push("Improve product discoverability with better categorization and search");
    }
    if (stages[2].dropoff > 30) {
      recommendations.push("Reduce cart abandonment with simplified checkout and saved carts");
    }
    if (stages[3].dropoff > 20) {
      recommendations.push("Optimize checkout flow to reduce friction");
    }
    if (stages[4].dropoff > 10) {
      recommendations.push("Add more payment options and improve payment success rate");
    }

    return {
      stages,
      overallConversion,
      biggestDropoff,
      recommendations,
    };
  } catch (error) {
    console.error("Failed to analyze funnel:", error);
    return { stages: [], overallConversion: 0, biggestDropoff: { stage: "", dropoff: 0 }, recommendations: [] };
  }
}

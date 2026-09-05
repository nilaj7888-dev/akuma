import { getPrisma } from "@/lib/db";

export interface PricingAnalysis {
  id: string;
  name: string;
  sku: string;
  currentPrice: number;
  currentCost: number;
  currentMargin: number;
  marginPercent: number;
  unitsSold30Days: number;
  totalRevenue30Days: number;
  recommendation: string;
  recommendedPrice: number;
  expectedRevenueImpact: number;
  expectedMarginImpact: number;
  confidence: number;
  riskScore: number;
}

export async function getPricingOptimization(merchantId: string): Promise<PricingAnalysis[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const products = await prisma.product.findMany({
      where: { merchantId, active: true },
      include: {
        orderItems: {
          include: {
            order: true,
          },
        },
      },
    });

    const analysis: PricingAnalysis[] = [];

    for (const product of products) {
      const salesData = product.orderItems.filter((oi) => oi.order.status === "PAID" && oi.order.createdAt >= thirtyDaysAgo);

      const unitsSold = salesData.reduce((sum, oi) => sum + oi.quantity, 0);
      const totalRevenue = salesData.reduce((sum, oi) => sum + oi.total, 0);
      const margin = product.price - product.cost;
      const marginPercent = product.price > 0 ? ((margin / product.price) * 100) : 0;

      let recommendation = "Monitor pricing";
      let recommendedPrice = product.price;
      let confidence = 40;
      let riskScore = 10;
      let expectedRevenueImpact = 0;
      let expectedMarginImpact = 0;

      // Low margin products: consider raising price
      if (marginPercent < 15 && unitsSold > 0) {
        const priceIncrease = Math.round(product.price * 0.1); // 10% increase
        recommendedPrice = product.price + priceIncrease;
        expectedRevenueImpact = Math.round(priceIncrease * unitsSold);
        expectedMarginImpact = expectedRevenueImpact;
        confidence = 55;
        riskScore = 35; // Risk of losing some sales
        recommendation = `Increase price by 10% (₹${Math.round(priceIncrease / 100)}) to improve margin`;
      }
      // High margin, low sales: consider testing lower price
      else if (marginPercent > 35 && unitsSold < 5) {
        const priceDecrease = Math.round(product.price * 0.15); // 15% decrease
        recommendedPrice = product.price - priceDecrease;
        expectedRevenueImpact = Math.round(priceDecrease * 5); // Assume 5 more sales
        expectedMarginImpact = Math.round(margin * 5) - Math.round((margin - priceDecrease) * 10);
        confidence = 45;
        riskScore = 40;
        recommendation = `Test 15% price reduction to increase volume`;
      }
      // Good margin, healthy sales: monitor
      else if (marginPercent > 20 && unitsSold > 5) {
        confidence = 70;
        riskScore = 5;
        recommendation = "Current price is optimal. Monitor competitor pricing.";
      }

      analysis.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        currentPrice: product.price / 100,
        currentCost: product.cost / 100,
        currentMargin: Math.round(margin / 100),
        marginPercent: Math.round(marginPercent * 10) / 10,
        unitsSold30Days: unitsSold,
        totalRevenue30Days: Math.round(totalRevenue / 100),
        recommendation,
        recommendedPrice: Math.round(recommendedPrice / 100),
        expectedRevenueImpact: Math.round(expectedRevenueImpact / 100),
        expectedMarginImpact: Math.round(expectedMarginImpact / 100),
        confidence,
        riskScore,
      });
    }

    // Sort by potential revenue impact
    return analysis.sort((a, b) => Math.abs(b.expectedRevenueImpact) - Math.abs(a.expectedRevenueImpact));
  } catch {
    return [];
  }
}

export interface PriceSimulation {
  currentPrice: number;
  newPrice: number;
  priceChangePercent: number;
  currentMargin: number;
  newMargin: number;
  estimatedVolumeChange: number;
  currentRevenue: number;
  projectedRevenue: number;
  revenueImpact: number;
  currentMarginTotal: number;
  projectedMarginTotal: number;
  marginImpact: number;
  recommendation: string;
}

export function simulatePriceChange(
  currentPrice: number,
  newPrice: number,
  unitsSoldLast30Days: number,
  currentCost: number
): PriceSimulation {
  const priceChangePercent = ((newPrice - currentPrice) / currentPrice) * 100;

  // Estimate volume change based on price elasticity (simplified)
  // Assume 2% volume change per 1% price change for typical products
  const volumeElasticity = -2;
  const estimatedVolumeChange = Math.round(unitsSoldLast30Days * (priceChangePercent * volumeElasticity) / 100);

  const currentMargin = currentPrice - currentCost;
  const newMargin = newPrice - currentCost;

  const currentRevenue = currentPrice * unitsSoldLast30Days;
  const projectedRevenue = newPrice * (unitsSoldLast30Days + estimatedVolumeChange);
  const revenueImpact = projectedRevenue - currentRevenue;

  const currentMarginTotal = currentMargin * unitsSoldLast30Days;
  const projectedMarginTotal = newMargin * (unitsSoldLast30Days + estimatedVolumeChange);
  const marginImpact = projectedMarginTotal - currentMarginTotal;

  let recommendation = "Simulation result";
  if (marginImpact > 0) {
    recommendation = `This price change would increase monthly margin by ₹${Math.abs(marginImpact)}`;
  } else if (marginImpact < 0) {
    recommendation = `This price change would decrease monthly margin by ₹${Math.abs(marginImpact)}`;
  }

  return {
    currentPrice,
    newPrice,
    priceChangePercent,
    currentMargin,
    newMargin,
    estimatedVolumeChange,
    currentRevenue,
    projectedRevenue,
    revenueImpact,
    currentMarginTotal,
    projectedMarginTotal,
    marginImpact,
    recommendation,
  };
}

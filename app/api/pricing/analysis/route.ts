import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPricingOptimization } from "@/lib/pricing";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

type PricingOpportunity = {
  productId: string;
  product: string;
  currentPrice: number;
  suggestedPrice: number;
  // No competitor pricing data source exists yet — never fabricate one.
  // Null until a real competitor-price feed is wired up.
  competitorAvg: number | null;
  potentialRevenue: number;
};

type PricingAnalysisResponse = {
  underpriced: number;
  overpriced: number;
  competitive: number;
  opportunities: PricingOpportunity[];
};

const EMPTY_RESPONSE: PricingAnalysisResponse = {
  underpriced: 0,
  overpriced: 0,
  competitive: 0,
  opportunities: [],
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json(EMPTY_RESPONSE);

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant) return NextResponse.json(EMPTY_RESPONSE);

    const analysis = await getPricingOptimization(merchant.id);

    // Transform the analysis array into the expected format
    const opportunities: PricingOpportunity[] = analysis
      .filter((item) => item.recommendation !== "Monitor pricing")
      .map((item) => ({
        productId: item.id,
        product: item.name,
        currentPrice: item.currentPrice,
        suggestedPrice: item.recommendedPrice,
        competitorAvg: null, // No competitor-price feed is connected yet.
        potentialRevenue: item.expectedRevenueImpact,
      }));

    const underpriced = analysis.filter(
      (item) => item.recommendedPrice > item.currentPrice && item.recommendation.includes("increase")
    ).length;

    const overpriced = analysis.filter(
      (item) => item.recommendedPrice < item.currentPrice && item.recommendation.includes("lower")
    ).length;

    const competitive = analysis.filter(
      (item) => item.recommendation === "Monitor pricing" || Math.abs(item.recommendedPrice - item.currentPrice) < item.currentPrice * 0.05
    ).length;

    const response: PricingAnalysisResponse = {
      underpriced,
      overpriced,
      competitive,
      opportunities,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch pricing analysis:", error);
    return NextResponse.json(EMPTY_RESPONSE);
  }
}

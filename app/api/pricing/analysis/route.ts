import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPricingOptimization } from "@/lib/pricing";
import { getPrisma } from "@/lib/db";

type PricingOpportunity = {
  product: string;
  currentPrice: number;
  suggestedPrice: number;
  competitorAvg: number;
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
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return NextResponse.json(EMPTY_RESPONSE);

    const analysis = await getPricingOptimization(merchant.id);

    // Transform the analysis array into the expected format
    const opportunities: PricingOpportunity[] = analysis
      .filter((item) => item.recommendation !== "Monitor pricing")
      .map((item) => ({
        product: item.name,
        currentPrice: item.currentPrice,
        suggestedPrice: item.recommendedPrice,
        competitorAvg: item.currentPrice * 0.95, // Placeholder: would come from competitor data
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

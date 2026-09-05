import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { getAllRecommendations } from "@/lib/merchant-recommendations";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    // Get merchant by session username
    const merchant = await prisma.merchant.findUnique({
      where: { email: session.username },
    });

    if (!merchant) return NextResponse.json([]);

    // Get top 5 AI recommendations
    const recommendations = await getAllRecommendations(merchant.id, 5);

    // Get real buyer demand matches (opportunities)
    const buyerDemandOpportunities = await prisma.opportunity.findMany({
      where: {
        merchantId: merchant.id,
        type: "BUYER_DEMAND_MATCH",
        status: { in: ["DISCOVERED", "PROPOSED", "ACTIVE"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Combine both sources
    const allOpportunities = [
      ...recommendations.map((opp) => ({
        id: `rec-${opp.type}-${Math.random().toString(36).substr(2, 9)}`,
        type: opp.type,
        title: opp.title,
        description: opp.description,
        confidence: opp.confidence,
        expectedRevenue: opp.expectedRevenue / 100,
        marginImpact: opp.marginImpact / 100,
        expectedLift: opp.expectedLift,
        riskScore: opp.riskScore,
        evidence: opp.evidence,
        recommendedAction: opp.recommendedAction,
        status: "AWAITING_APPROVAL",
      })),
      ...buyerDemandOpportunities.map((opp) => ({
        id: opp.id,
        type: "BUYER_DEMAND_MATCH",
        title: `Buyer demand: ${(opp.evidence as Record<string, unknown>)?.productName || "Product"}`,
        description: `A buyer is looking for ${(opp.evidence as Record<string, unknown>)?.quantity || 1} unit(s). Match score: ${(opp.evidence as Record<string, unknown>)?.matchScore || 0}%`,
        confidence: ((opp.evidence as Record<string, unknown>)?.matchScore as number) || 50,
        expectedRevenue: (opp.evidence as Record<string, unknown>)?.estimatedValue as number || 0,
        marginImpact: 10,
        expectedLift: 5,
        riskScore: 10,
        evidence: opp.evidence as Record<string, unknown>,
        recommendedAction: "Contact buyer with your product offer",
        status: opp.status,
      })),
    ];

    return NextResponse.json(allOpportunities);
  } catch (error) {
    console.error("Failed to fetch opportunities:", error);
    return NextResponse.json([]);
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

// Pending decisions the merchant actually needs to make: real, persisted
// Opportunity rows waiting on a human. Never a recommendation-only card —
// those aren't approvable yet (see /api/dashboard/opportunities).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await resolveMerchant(prisma, session);
    if (!merchant) return NextResponse.json([]);

    const pending = await prisma.opportunity.findMany({
      where: { merchantId: merchant.id, status: { in: ["DISCOVERED", "PROPOSED", "APPROVAL_REQUIRED"] } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      pending.map((opportunity) => ({
        id: opportunity.id,
        type: opportunity.type,
        title: opportunity.title,
        description: opportunity.description,
        confidence: opportunity.confidence,
        expectedRevenue: opportunity.expectedRevenue / 100,
        expectedLift: opportunity.expectedLift,
        riskScore: opportunity.riskScore,
        marginImpact: opportunity.marginImpact / 100,
        createdAt: opportunity.createdAt,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch approvals:", error);
    return NextResponse.json([]);
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { getTopOpportunities } from "@/lib/analytics";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
    if (!merchant) return NextResponse.json([]);

    const opportunities = await getTopOpportunities(merchant.id, 10);
    return NextResponse.json(opportunities.map(opp => ({
      ...opp,
      expectedRevenue: opp.expectedRevenue / 100, // Convert from paise to rupees
      marginImpact: opp.marginImpact / 100,
    })));
  } catch {
    return NextResponse.json([]);
  }
}

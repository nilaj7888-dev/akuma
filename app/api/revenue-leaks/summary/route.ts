import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLeakSummary, type LeakSummary } from "@/lib/revenue-leaks";
import { getPrisma } from "@/lib/db";

const emptySummary: LeakSummary = {
  totalLeaksIdentified: 0,
  totalEstimatedLoss: 0,
  criticalLeaks: 0,
  highRiskLeaks: 0,
  leaksByType: {},
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json(emptySummary);

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return NextResponse.json(emptySummary);

    const summary = await getLeakSummary(merchant.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to get leak summary:", error);
    return NextResponse.json(emptySummary);
  }
}

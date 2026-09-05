import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { analyzeConversionFunnel } from "@/lib/funnel";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ stages: [], overallConversion: 0, biggestDropoff: { stage: "", dropoff: 0 }, recommendations: [] });

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant) return NextResponse.json({ stages: [], overallConversion: 0, biggestDropoff: { stage: "", dropoff: 0 }, recommendations: [] });

    const analysis = await analyzeConversionFunnel(merchant.id);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Failed to fetch funnel analysis:", error);
    return NextResponse.json({ error: "Failed to analyze funnel" }, { status: 500 });
  }
}

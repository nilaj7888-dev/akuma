import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInventorySummary, type InventorySummary } from "@/lib/inventory";
import { getPrisma } from "@/lib/db";

const emptySummary: InventorySummary = {
  totalProducts: 0,
  criticalRiskCount: 0,
  highRiskCount: 0,
  outOfStockCount: 0,
  excessInventoryCount: 0,
  totalInventoryValue: 0,
  atRiskValue: 0,
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

    const summary = await getInventorySummary(merchant.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to fetch inventory summary:", error);
    return NextResponse.json(emptySummary);
  }
}

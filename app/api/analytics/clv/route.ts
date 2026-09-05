import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCustomerLifetimeValue } from "@/lib/acquisition";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant) return NextResponse.json([]);

    const clvData = await getCustomerLifetimeValue(merchant.id);

    // Calculate summary metrics
    const totalClv = clvData.reduce((sum, c) => sum + c.estimatedLifetimeValue, 0);
    const avgClv = clvData.length > 0 ? totalClv / clvData.length : 0;
    const highValueCustomers = clvData.filter(c => c.estimatedLifetimeValue > 100000).length;
    const atRiskCustomers = clvData.filter(c => c.retentionRisk === "HIGH").length;

    return NextResponse.json({
      summary: {
        totalCustomers: clvData.length,
        totalClv: Math.round(totalClv),
        averageClv: Math.round(avgClv),
        highValueCustomers,
        atRiskCustomers,
        segments: {
          vip: clvData.filter(c => c.segment === "VIP").length,
          loyal: clvData.filter(c => c.segment === "LOYAL").length,
          active: clvData.filter(c => c.segment === "ACTIVE").length,
          atRisk: clvData.filter(c => c.segment === "AT_RISK").length
        }
      },
      customers: clvData,
    });
  } catch (error) {
    console.error("Failed to fetch CLV data:", error);
    return NextResponse.json([]);
  }
}
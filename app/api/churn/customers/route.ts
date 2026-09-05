import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChurnRiskCustomers } from "@/lib/churn";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

export async function GET() {
  const session = await getSession();
  if (!session) {
    // Return empty array instead of error for unauthenticated requests
    return NextResponse.json([]);
  }

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant) return NextResponse.json([]);

    const atRiskCustomers = await getChurnRiskCustomers(merchant.id);
    return NextResponse.json(atRiskCustomers);
  } catch (error) {
    console.error("Failed to fetch churn customers:", error);
    return NextResponse.json([]);
  }
}

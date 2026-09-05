import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChurnRiskCustomers } from "@/lib/churn";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    // Return empty array instead of error for unauthenticated requests
    return NextResponse.json([]);
  }

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return NextResponse.json([]);

    const atRiskCustomers = await getChurnRiskCustomers(merchant.id);
    return NextResponse.json(atRiskCustomers);
  } catch (error) {
    console.error("Failed to fetch churn customers:", error);
    return NextResponse.json([]);
  }
}

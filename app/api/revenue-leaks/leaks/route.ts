import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { identifyRevenueLeaks } from "@/lib/revenue-leaks";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return NextResponse.json([]);

    const leaks = await identifyRevenueLeaks(merchant.id);
    return NextResponse.json(leaks);
  } catch (error) {
    console.error("Failed to identify revenue leaks:", error);
    return NextResponse.json([]);
  }
}

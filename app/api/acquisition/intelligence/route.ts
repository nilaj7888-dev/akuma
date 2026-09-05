import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAcquisitionIntelligence } from "@/lib/acquisition";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ topAcquisitionProducts: [], opportunities: [] });

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return NextResponse.json({ topAcquisitionProducts: [], opportunities: [] });

    const result = await getAcquisitionIntelligence(merchant.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch acquisition intelligence:", error);
    return NextResponse.json({ topAcquisitionProducts: [], opportunities: [] });
  }
}

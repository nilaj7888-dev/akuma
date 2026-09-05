import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSegmentSummary } from "@/lib/segmentation";
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

    const summary = await getSegmentSummary(merchant.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to fetch segment summary:", error);
    return NextResponse.json([]);
  }
}

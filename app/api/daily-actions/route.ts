import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTopActionsForToday } from "@/lib/daily-actions";
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

    const actions = await getTopActionsForToday(merchant.id, 5);
    return NextResponse.json(actions);
  } catch (error) {
    console.error("Failed to fetch daily actions:", error);
    return NextResponse.json([]);
  }
}

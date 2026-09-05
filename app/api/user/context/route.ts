import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { id: session.userId || "" } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const merchant = user.merchantId
    ? await prisma.merchant.findUnique({ where: { id: user.merchantId } })
    : null;

  const policy = merchant
    ? await prisma.policy.findUnique({ where: { merchantId: merchant.id } })
    : null;

  return NextResponse.json({
    businessContext: user.onboardingContext,
    merchantLocation: merchant ? { lat: merchant.latitude, lon: merchant.longitude, address: merchant.location } : null,
    deliveryRadius: merchant?.deliveryRadius,
    negotiationPolicy: policy?.negotiationPreference,
    businessPriority: policy?.primaryGoal,
    buyerPriority: (user.onboardingContext as any)?.buyerPriority,
  });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  const resolved = await resolveMerchant(prisma, session);
  const merchant = resolved
    ? await prisma.merchant.findUnique({ where: { id: resolved.id }, select: { id: true, deliveryRadius: true, location: true, latitude: true, longitude: true } })
    : null;
  if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

  const policy = await prisma.policy.findUnique({ where: { merchantId: merchant.id } });
  return NextResponse.json({
    deliveryRadius: merchant.deliveryRadius,
    negotiationPreference: policy?.negotiationPreference || "ASK_ME_FIRST",
    primaryGoal: policy?.primaryGoal || "INCREASE_REVENUE",
    location: merchant.location,
    latitude: merchant.latitude,
    longitude: merchant.longitude,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  const resolved = await resolveMerchant(prisma, session);
  const merchant = resolved
    ? await prisma.merchant.findUnique({ where: { id: resolved.id }, select: { id: true, deliveryRadius: true } })
    : null;
  if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

  const body = await request.json() as {
    deliveryRadius?: string;
    negotiationPreference?: string;
    primaryGoal?: string;
  };

  // Update merchant delivery radius
  if (body.deliveryRadius) {
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { deliveryRadius: body.deliveryRadius },
    });
  }

  // Update or create policy
  let policy = await prisma.policy.findUnique({ where: { merchantId: merchant.id } });

  if (!policy) {
    policy = await prisma.policy.create({
      data: {
        merchantId: merchant.id,
        negotiationPreference: body.negotiationPreference || "ASK_ME_FIRST",
        primaryGoal: body.primaryGoal || "INCREASE_REVENUE",
        allowedActions: [],
      },
    });
  } else {
    policy = await prisma.policy.update({
      where: { merchantId: merchant.id },
      data: {
        negotiationPreference: body.negotiationPreference || policy.negotiationPreference,
        primaryGoal: body.primaryGoal || policy.primaryGoal,
      },
    });
  }

  return NextResponse.json({
    deliveryRadius: body.deliveryRadius || merchant.deliveryRadius,
    negotiationPreference: policy.negotiationPreference,
    primaryGoal: policy.primaryGoal,
  });
}

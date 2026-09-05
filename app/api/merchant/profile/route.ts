import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const resolved = await resolveMerchant(prisma, session);
  const merchant = resolved
    ? await prisma.merchant.findUnique({
        where: { id: resolved.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          location: true,
          latitude: true,
          longitude: true,
          deliveryRadius: true,
          currency: true,
          timezone: true,
        },
      })
    : null;

  if (!merchant) {
    return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant profile not found." } }, { status: 404 });
  }

  return NextResponse.json(merchant);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const body = await request.json();
  const { name, phone, location, deliveryRadius } = body;

  const merchant = await resolveMerchant(prisma, session);

  if (!merchant) {
    return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant profile not found." } }, { status: 404 });
  }

  // Update the merchant profile
  const updatedMerchant = await prisma.merchant.update({
    where: { id: merchant.id },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(location !== undefined && { location }),
      ...(deliveryRadius !== undefined && { deliveryRadius }),
    },
  });

  return NextResponse.json(updatedMerchant);
}

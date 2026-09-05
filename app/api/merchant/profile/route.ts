import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Find the merchant associated with the session
  const merchant = await prisma.merchant.findFirst({
    where: { users: { some: { id: session.userId || "" } } },
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
  });

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

  // Find the merchant associated with the session
  const merchant = await prisma.merchant.findFirst({
    where: { users: { some: { id: session.userId || "" } } },
  });

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

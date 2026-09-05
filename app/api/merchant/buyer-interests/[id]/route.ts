import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const responseSchema = z.object({
  merchantResponse: z.string().optional(),
  merchantCounterPrice: z.number().int().positive().optional(),
});

// GET /api/merchant/buyer-interests/[id] - get specific buyer interest
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get merchant ID
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { merchantId: true },
  });

  if (!user || !user.merchantId) return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

  const interest = await prisma.buyerInterest.findUnique({
    where: { id: params.id },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      product: {
        select: { id: true, name: true, price: true, description: true },
      },
    },
  });

  if (!interest || interest.merchantId !== user.merchantId) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Interest not found." } }, { status: 404 });
  }

  // Mark as seen if not already
  if (!interest.merchantSeen) {
    await prisma.buyerInterest.update({
      where: { id: params.id },
      data: { merchantSeen: true, merchantSeenAt: new Date() },
    });
  }

  // Get buyer's delivery address info (if order consent given)
  const profile = await prisma.consumerProfile.findUnique({
    where: { userId: interest.userId },
    include: {
      deliveryAddresses: {
        where: { contactConsent: true },
        select: { id: true, name: true, phone: true, addressLine1: true, city: true, state: true, postalCode: true },
      },
    },
  });

  return NextResponse.json({
    id: interest.id,
    buyer: {
      id: interest.user.id,
      name: interest.user.name,
      email: interest.user.email,
      phone: profile?.phone,
      deliveryAddresses: profile?.deliveryAddresses || [],
    },
    product: {
      id: interest.product.id,
      name: interest.product.name,
      pricePaise: interest.product.price,
      description: interest.product.description,
    },
    quantity: interest.quantity,
    preferredPricePaise: interest.preferredPrice,
    requirements: interest.requirements,
    status: interest.status,
    merchantResponse: interest.merchantResponse,
    merchantCounterPricePaise: interest.merchantCounterPrice,
    acceptedPricePaise: interest.acceptedPrice,
    merchantSeenAt: interest.merchantSeenAt,
    expiresAt: interest.expiresAt,
    createdAt: interest.createdAt,
  });
}

// PATCH /api/merchant/buyer-interests/[id] - respond to buyer interest with counter offer
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const parsed = responseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid response data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get merchant ID
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { merchantId: true },
  });

  if (!user || !user.merchantId) return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

  const interest = await prisma.buyerInterest.findUnique({
    where: { id: params.id },
  });

  if (!interest || interest.merchantId !== user.merchantId) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Interest not found." } }, { status: 404 });
  }

  // Validate counter price if provided
  if (parsed.data.merchantCounterPrice) {
    const product = await prisma.product.findUnique({
      where: { id: interest.productId },
    });
    if (!product) return NextResponse.json({ error: { code: "AKUMA_PRODUCT_NOT_FOUND", message: "Product not found." } }, { status: 404 });

    // Counter price should be > 0 and reasonable
    if (parsed.data.merchantCounterPrice < 0) {
      return NextResponse.json({ error: { code: "AKUMA_INVALID_PRICE", message: "Counter price must be positive." } }, { status: 400 });
    }
  }

  // Update interest with merchant response
  const updated = await prisma.buyerInterest.update({
    where: { id: params.id },
    data: {
      status: "OFFER_MADE",
      merchantResponse: parsed.data.merchantResponse,
      merchantCounterPrice: parsed.data.merchantCounterPrice,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      merchantId: user.merchantId,
      actorType: "USER",
      actorId: session.userId,
      action: "MERCHANT_OFFER_MADE",
      resourceType: "BuyerInterest",
      resourceId: interest.id,
      input: { merchantResponse: parsed.data.merchantResponse, merchantCounterPrice: parsed.data.merchantCounterPrice },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    },
  });

  return NextResponse.json({
    id: updated.id,
    message: "Merchant offer sent successfully",
    status: updated.status,
    merchantCounterPricePaise: updated.merchantCounterPrice,
  });
}

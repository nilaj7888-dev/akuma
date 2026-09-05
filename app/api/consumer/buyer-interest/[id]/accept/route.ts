import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const acceptOfferSchema = z.object({
  deliveryAddressId: z.string(),
  acceptedPrice: z.number().int().positive(),
});

// POST /api/consumer/buyer-interest/[id]/accept - buyer accepts merchant offer
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const parsed = acceptOfferSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid acceptance data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get buyer interest
  const interest = await prisma.buyerInterest.findUnique({
    where: { id: params.id },
    include: {
      product: {
        select: { id: true, price: true, name: true, merchantId: true },
      },
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!interest || interest.userId !== session.userId) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Interest not found." } }, { status: 404 });
  }

  if (interest.status !== "OFFER_MADE") {
    return NextResponse.json({ error: { code: "AKUMA_INVALID_STATUS", message: "Interest must be in OFFER_MADE status." } }, { status: 400 });
  }

  // Verify delivery address ownership and consent
  const profile = await prisma.consumerProfile.findUnique({
    where: { userId: session.userId },
  });

  if (!profile) return NextResponse.json({ error: { code: "AKUMA_PROFILE_NOT_FOUND", message: "Profile not found." } }, { status: 404 });

  const address = await prisma.deliveryAddress.findUnique({
    where: { id: parsed.data.deliveryAddressId },
  });

  if (!address || address.profileId !== profile.id || !address.contactConsent) {
    return NextResponse.json({ error: { code: "AKUMA_ADDRESS_INVALID", message: "Invalid delivery address." } }, { status: 400 });
  }

  // Validate accepted price matches either merchant counter or original price
  const validPrice = parsed.data.acceptedPrice === interest.merchantCounterPrice || parsed.data.acceptedPrice === interest.product.price;
  if (!validPrice) {
    return NextResponse.json({ error: { code: "AKUMA_INVALID_PRICE", message: "Accepted price does not match offer." } }, { status: 400 });
  }

  // Create order
  const totalAmount = parsed.data.acceptedPrice * interest.quantity;

  const order = await prisma.order.create({
    data: {
      merchantId: interest.product.merchantId,
      consumerId: session.userId,
      amount: totalAmount,
      currency: "INR",
      status: "PAYMENT_PENDING",
      source: "BUYER_INTEREST",
      buyerInterestId: interest.id,
      items: {
        create: {
          productId: interest.product.id,
          quantity: interest.quantity,
          unitPrice: parsed.data.acceptedPrice,
          total: totalAmount,
        },
      },
    },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
        },
      },
    },
  });

  // Update buyer interest
  await prisma.buyerInterest.update({
    where: { id: params.id },
    data: {
      status: "ACCEPTED",
      acceptedPrice: parsed.data.acceptedPrice,
      acceptedDeliveryAddressId: parsed.data.deliveryAddressId,
      convertedToOrder: true,
      orderId: order.id,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      merchantId: interest.product.merchantId,
      actorType: "USER",
      actorId: session.userId,
      action: "BUYER_ACCEPTED_OFFER",
      resourceType: "Order",
      resourceId: order.id,
      input: {
        buyerInterestId: interest.id,
        deliveryAddressId: parsed.data.deliveryAddressId,
        acceptedPrice: parsed.data.acceptedPrice,
        quantity: interest.quantity,
        totalAmount,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    },
  });

  return NextResponse.json({
    orderId: order.id,
    message: "Offer accepted and order created successfully",
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      items: order.items.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    },
  }, { status: 201 });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import Razorpay from "razorpay";

// POST /api/consumer/checkout/razorpay - create Razorpay order for payment
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const body = await request.json().catch(() => null) as { orderId?: string } | null;
  if (!body?.orderId) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Order ID required." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Verify order ownership and status
  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: {
      merchant: { select: { razorpayAccountId: true, currency: true } },
    },
  });

  if (!order || order.consumerId !== session.userId) {
    return NextResponse.json({ error: { code: "AKUMA_ORDER_NOT_FOUND", message: "Order not found." } }, { status: 404 });
  }

  if (order.status !== "PAYMENT_PENDING") {
    return NextResponse.json({ error: { code: "AKUMA_INVALID_STATUS", message: "Order is not ready for payment." } }, { status: 400 });
  }

  // Verify merchant has Razorpay account
  if (!order.merchant.razorpayAccountId) {
    return NextResponse.json({ error: { code: "AKUMA_RAZORPAY_NOT_CONFIGURED", message: "Merchant Razorpay account not configured." } }, { status: 503 });
  }

  // Create Razorpay order
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: order.amount,
      currency: order.merchant.currency || "INR",
      receipt: `order_${order.id}`,
      payment_capture: true, // Auto-capture
      notes: {
        orderId: order.id,
        merchantId: order.merchantId,
      },
    });

    // Update order with Razorpay order ID
    await prisma.order.update({
      where: { id: order.id },
      data: {
        razorpayOrderId: razorpayOrder.id,
        status: "PENDING",
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        merchantId: order.merchantId,
        orderId: order.id,
        amount: order.amount,
        currency: order.merchant.currency || "INR",
        status: "CREATED",
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        merchantId: order.merchantId,
        actorType: "USER",
        actorId: session.userId,
        action: "RAZORPAY_ORDER_CREATED",
        resourceType: "Order",
        resourceId: order.id,
        input: { razorpayOrderId: razorpayOrder.id, amount: order.amount },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error);
    return NextResponse.json({ error: { code: "AKUMA_RAZORPAY_ERROR", message: "Payment gateway error." } }, { status: 500 });
  }
}

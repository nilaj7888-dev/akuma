import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import crypto from "node:crypto";

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Verify Razorpay webhook signature
function verifySignature(body: string, signature: string): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) return false;
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

// POST /api/webhooks/razorpay - handle Razorpay payment webhooks
export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  const body = await request.text();

  if (!signature || !verifySignature(body, signature)) {
    console.error("Razorpay webhook: Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    console.error("Razorpay webhook: Invalid JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.event;
  const payload = event.payload || {};

  const prisma = getPrisma();
  if (!prisma) {
    console.error("Razorpay webhook: Database unavailable");
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    // Store webhook event first for audit trail
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        eventId: event.id || `fallback_${Date.now()}`,
        eventType: eventType,
        payload: payload as any,
        signatureVerified: true,
        processed: false,
      },
    }).catch(() => null); // Ignore duplicate eventId errors

    // Process based on event type
    switch (eventType) {
      case "payment.captured":
        await handlePaymentCaptured(prisma, payload);
        break;

      case "payment.failed":
        await handlePaymentFailed(prisma, payload);
        break;

      case "payment.authorized":
        await handlePaymentAuthorized(prisma, payload);
        break;

      default:
        console.log(`Razorpay webhook: Unhandled event type: ${eventType}`);
    }

    // Mark webhook as processed (if created successfully)
    if (webhookEvent) {
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Razorpay webhook:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function handlePaymentCaptured(prisma: any, payload: any) {
  const payment = payload.payment?.entity;
  if (!payment || !payment.order_id) {
    console.error("Razorpay webhook: Invalid payment captured event");
    return;
  }

  // Find order by Razorpay order ID
  const order = await prisma.order.findUnique({
    where: { razorpayOrderId: payment.order_id },
    include: { merchant: true },
  });

  if (!order) {
    console.warn(`Razorpay webhook: Order not found for razorpayOrderId ${payment.order_id}`);
    return;
  }

  // Check if already processed (idempotency)
  const existingTransaction = await prisma.transaction.findUnique({
    where: { orderId: order.id },
  });

  if (existingTransaction?.razorpayPaymentId === payment.id && existingTransaction.status === "CAPTURED") {
    console.log(`Razorpay webhook: Payment ${payment.id} already captured for order ${order.id}`);
    return; // Idempotent: already processed
  }

  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID" },
  });

  // Update or create transaction
  await prisma.transaction.upsert({
    where: { orderId: order.id },
    update: {
      razorpayPaymentId: payment.id,
      status: "CAPTURED",
      verified: true,
    },
    create: {
      merchantId: order.merchantId,
      orderId: order.id,
      razorpayPaymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency || "INR",
      status: "CAPTURED",
      verified: true,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      merchantId: order.merchantId,
      actorType: "RAZORPAY",
      action: "PAYMENT_CAPTURED",
      resourceType: "Order",
      resourceId: order.id,
      input: { paymentId: payment.id, amount: payment.amount },
      output: { status: "PAID", transactionId: order.id },
    },
  });

  // Create notification for merchant
  await prisma.notification.create({
    data: {
      merchantId: order.merchantId,
      type: "PAYMENT_RECEIVED",
      title: "Payment Received",
      message: `Payment of ₹${(payment.amount / 100).toLocaleString("en-IN")} received for order ${order.id.slice(0, 8)}`,
      resourceType: "Order",
      resourceId: order.id,
      actionUrl: `/dashboard/orders`,
      metadata: { paymentId: payment.id, razorpayOrderId: payment.order_id, amount: payment.amount },
    },
  });

  console.log(`Razorpay webhook: Payment ${payment.id} captured for order ${order.id}`);
}

async function handlePaymentFailed(prisma: any, payload: any) {
  const payment = payload.payment?.entity;
  if (!payment || !payment.order_id) {
    console.error("Razorpay webhook: Invalid payment failed event");
    return;
  }

  const order = await prisma.order.findUnique({
    where: { razorpayOrderId: payment.order_id },
  });

  if (!order) {
    console.warn(`Razorpay webhook: Order not found for razorpayOrderId ${payment.order_id}`);
    return;
  }

  // Check if already processed
  const existingTransaction = await prisma.transaction.findUnique({
    where: { orderId: order.id },
  });

  if (existingTransaction?.razorpayPaymentId === payment.id && existingTransaction.status === "FAILED") {
    console.log(`Razorpay webhook: Payment ${payment.id} already marked as failed for order ${order.id}`);
    return;
  }

  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "FAILED" },
  });

  // Update transaction
  await prisma.transaction.upsert({
    where: { orderId: order.id },
    update: {
      razorpayPaymentId: payment.id,
      status: "FAILED",
      failureReason: payment.error_description || "Payment failed",
    },
    create: {
      merchantId: order.merchantId,
      orderId: order.id,
      razorpayPaymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency || "INR",
      status: "FAILED",
      failureReason: payment.error_description || "Payment failed",
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      merchantId: order.merchantId,
      actorType: "RAZORPAY",
      action: "PAYMENT_FAILED",
      resourceType: "Order",
      resourceId: order.id,
      input: { paymentId: payment.id, failureReason: payment.error_description },
    },
  });

  console.log(`Razorpay webhook: Payment ${payment.id} failed for order ${order.id}`);
}

async function handlePaymentAuthorized(prisma: any, payload: any) {
  const payment = payload.payment?.entity;
  if (!payment || !payment.order_id) {
    console.error("Razorpay webhook: Invalid payment authorized event");
    return;
  }

  const order = await prisma.order.findUnique({
    where: { razorpayOrderId: payment.order_id },
  });

  if (!order) {
    console.warn(`Razorpay webhook: Order not found for razorpayOrderId ${payment.order_id}`);
    return;
  }

  // Check if already processed
  const existingTransaction = await prisma.transaction.findUnique({
    where: { orderId: order.id },
  });

  if (existingTransaction?.razorpayPaymentId === payment.id && existingTransaction.status === "AUTHORIZED") {
    console.log(`Razorpay webhook: Payment ${payment.id} already authorized for order ${order.id}`);
    return;
  }

  // Update transaction
  await prisma.transaction.upsert({
    where: { orderId: order.id },
    update: {
      razorpayPaymentId: payment.id,
      status: "AUTHORIZED",
    },
    create: {
      merchantId: order.merchantId,
      orderId: order.id,
      razorpayPaymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency || "INR",
      status: "AUTHORIZED",
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      merchantId: order.merchantId,
      actorType: "RAZORPAY",
      action: "PAYMENT_AUTHORIZED",
      resourceType: "Order",
      resourceId: order.id,
      input: { paymentId: payment.id },
    },
  });

  console.log(`Razorpay webhook: Payment ${payment.id} authorized for order ${order.id}`);
}

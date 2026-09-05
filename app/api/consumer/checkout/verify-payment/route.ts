import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await request.json() as { orderId: string };
  if (!orderId) return NextResponse.json({ error: "Order ID required" }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, merchant: true, transaction: true },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.consumerId !== session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // Verify Razorpay payment if not already verified
    if (order.transaction && !order.transaction.verified && order.transaction.razorpayPaymentId) {
      const razorpay = await import("@/lib/razorpay");
      const verified = await razorpay.verifyPayment(order.transaction.razorpayPaymentId, order.amount);

      if (!verified) {
        await prisma.transaction.update({
          where: { id: order.transaction.id },
          data: { status: "FAILED", failureReason: "Payment verification failed" },
        });
        await prisma.order.update({ where: { id: orderId }, data: { status: "FAILED" } });
        return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
      }

      // Mark transaction as verified
      await prisma.transaction.update({
        where: { id: order.transaction.id },
        data: { status: "CAPTURED", verified: true },
      });

      // Update order status to PAID
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "PAID" },
      });

      // Create audit log for payment verification
      await prisma.auditLog.create({
        data: {
          merchantId: order.merchantId,
          actorType: "RAZORPAY",
          action: "PAYMENT_VERIFIED",
          resourceType: "ORDER",
          resourceId: orderId,
          reason: "Razorpay payment verified",
          input: { razorpayPaymentId: order.transaction.razorpayPaymentId, amount: order.amount } as unknown as undefined,
        },
      });

      // Create merchant notification
      await prisma.notification.create({
        data: {
          merchantId: order.merchantId,
          type: "PAYMENT_RECEIVED",
          title: `Payment received for order ${orderId.slice(0, 8)}`,
          message: `₹${(order.amount / 100).toLocaleString("en-IN")} received from buyer`,
          resourceType: "ORDER",
          resourceId: orderId,
          actionUrl: `/dashboard/orders/${orderId}`,
        },
      });
    }

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";
import { z } from "zod";

const verifySchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

// POST /api/consumer/checkout/verify - verify Razorpay payment
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid payment data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    // Verify Razorpay signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "");
    hmac.update(`${parsed.data.razorpayOrderId}|${parsed.data.razorpayPaymentId}`);
    const digest = hmac.digest("hex");

    if (digest !== parsed.data.razorpaySignature) {
      return NextResponse.json({ error: { code: "AKUMA_INVALID_SIGNATURE", message: "Payment verification failed." } }, { status: 400 });
    }

    // Find order and verify consumer owns it
    const order = await prisma.order.findFirst({
      where: {
        razorpayOrderId: parsed.data.razorpayOrderId,
        consumerId: session.userId,
      },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: { code: "AKUMA_ORDER_NOT_FOUND", message: "Order not found." } }, { status: 404 });
    }

    // Create or update transaction record
    const transaction = await prisma.transaction.upsert({
      where: { orderId: order.id },
      update: {
        razorpayPaymentId: parsed.data.razorpayPaymentId,
        status: "CAPTURED",
        verified: true,
      },
      create: {
        merchantId: order.merchantId,
        orderId: order.id,
        razorpayPaymentId: parsed.data.razorpayPaymentId,
        amount: order.amount,
        status: "CAPTURED",
        verified: true,
      },
    });

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED" },
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    // Reduce product stock
    for (const item of updatedOrder.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        merchantId: order.merchantId,
        actorType: "SYSTEM",
        action: "PAYMENT_VERIFIED",
        resourceType: "ORDER",
        resourceId: order.id,
        output: {
          razorpayPaymentId: parsed.data.razorpayPaymentId,
          amount: order.amount,
        },
      },
    });

    // Clear cart
    await prisma.cartItem.deleteMany({
      where: { session: { userId: session.userId } },
    });

    // Notify the merchant of the real, paid order — in-app notification + email.
    // Best-effort by design: the payment is already verified and the order is
    // CONFIRMED, so a Resend/DB hiccup here must never turn a successful purchase
    // into an error for the buyer. The recipient is ALWAYS the merchant's stored
    // email (Order -> Merchant.email) — never the buyer or a hardcoded address.
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { id: order.merchantId },
        select: { name: true, email: true },
      });

      const itemCount = updatedOrder.items.reduce((sum, i) => sum + i.quantity, 0);
      const amountDisplay = `₹${(updatedOrder.amount / 100).toLocaleString("en-IN")}`;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const orderUrl = `${baseUrl}/dashboard/orders/${updatedOrder.id}`;

      await createNotification(prisma, order.merchantId, {
        type: "ORDER_CREATED",
        title: `New paid order · ${amountDisplay}`,
        message: `Payment verified for ${itemCount} item${itemCount === 1 ? "" : "s"}. Order ${updatedOrder.id.slice(0, 8)} is ready to fulfill.`,
        resourceType: "ORDER",
        resourceId: updatedOrder.id,
        actionUrl: `/dashboard/orders/${updatedOrder.id}`,
        metadata: {
          amount: updatedOrder.amount,
          items: updatedOrder.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
        },
      });

      if (merchant?.email) {
        const rows = updatedOrder.items
          .map(
            (i) =>
              `<tr><td style="padding:6px 0;color:#333;">${i.product?.name ?? i.productId} &times; ${i.quantity}</td><td style="padding:6px 0;text-align:right;color:#333;">₹${(i.total / 100).toLocaleString("en-IN")}</td></tr>`
          )
          .join("");

        await sendEmail(
          merchant.email,
          `New paid order on AKUMA — ${amountDisplay}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="color:#e9a85d;font-size:26px;margin:0;">AKUMA</h1>
              <p style="color:#666;margin:4px 0 0;">You have a new paid order</p>
            </div>
            <div style="background:#f9f9f9;border-radius:10px;padding:24px;">
              <p style="color:#333;margin:0 0 12px;">Hi ${merchant.name || "there"}, a customer just completed a verified payment.</p>
              <table style="width:100%;border-collapse:collapse;margin:12px 0;">
                ${rows}
                <tr>
                  <td style="padding:12px 0 0;border-top:1px solid #e5e5e5;"><strong style="color:#333;">Total</strong></td>
                  <td style="padding:12px 0 0;border-top:1px solid #e5e5e5;text-align:right;"><strong style="color:#e9a85d;font-size:18px;">${amountDisplay}</strong></td>
                </tr>
              </table>
              <p style="color:#999;font-size:12px;margin:16px 0 0;">Order ${updatedOrder.id}</p>
              <div style="text-align:center;margin-top:24px;">
                <a href="${orderUrl}" style="background:#e9a85d;color:#fff;padding:12px 26px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View order in AKUMA</a>
              </div>
            </div>
          </div>`
        );
      }
    } catch (notifyError) {
      console.error("Post-payment merchant notification/email failed:", notifyError);
    }

    return NextResponse.json({
      success: true,
      orderId: updatedOrder.id,
      status: "CONFIRMED",
      amount: updatedOrder.amount,
      amountDisplay: `₹${(updatedOrder.amount / 100).toLocaleString("en-IN")}`,
    });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json({ error: { code: "AKUMA_VERIFICATION_ERROR", message: "Payment verification error." } }, { status: 500 });
  }
}

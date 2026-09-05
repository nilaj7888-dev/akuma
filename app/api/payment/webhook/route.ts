import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPrisma } from "@/lib/db";
import { RAZORPAY_WEBHOOK_SECRET } from "@/lib/razorpay";

interface RazorpayWebhookEvent {
  event: string;
  created_at: number;
  entity: string;
  payload?: {
    order?: {
      entity: {
        id: string;
        receipt: string;
        amount: number;
        currency: string;
        notes?: Record<string, string>;
      };
    };
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        notes?: Record<string, string>;
      };
    };
  };
}

function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    console.error("RAZORPAY_WEBHOOK_SECRET not configured");
    return false;
  }

  try {
    const hash = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    return hash === signature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // Read raw body for signature verification
    const rawBody = await request.text();

    // Extract signature from header
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      console.warn("Missing x-razorpay-signature header");
      return NextResponse.json(
        { error: { code: "MISSING_SIGNATURE", message: "Missing webhook signature header." } },
        { status: 400 }
      );
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn("Invalid webhook signature");
      return NextResponse.json(
        { error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature." } },
        { status: 400 }
      );
    }

    // Parse event body
    let event: RazorpayWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      console.error("Failed to parse webhook body");
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON in webhook body." } },
        { status: 400 }
      );
    }

    // Get Prisma client
    const prisma = getPrisma();
    if (!prisma) {
      console.error("Database not connected");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Database not available." } },
        { status: 503 }
      );
    }

    console.log(`[Webhook] Received event: ${event.event}`);

    // Handle payment.captured event
    if (event.event === "payment.captured") {
      if (!event.payload?.payment?.entity) {
        console.warn("Missing payment entity in payload");
        return NextResponse.json({ status: "ok" }); // Return 200 to acknowledge
      }

      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      if (!orderId) {
        console.warn("Missing order_id in payment entity");
        return NextResponse.json({ status: "ok" }); // Return 200 to acknowledge
      }

      // Extract negotiationId from receipt metadata
      // First, try to fetch from Razorpay order notes, otherwise fallback to receipt parsing
      const notes = payment.notes as Record<string, string> | undefined;
      let negotiationId = notes?.negotiationId;

      if (!negotiationId) {
        // Try to parse from receipt format: rcpt_${negotiationId}
        // This is a fallback in case metadata isn't available
        console.warn("Could not find negotiationId in payment notes");
        // In production, you'd want more robust fallback logic
        return NextResponse.json({ status: "ok" }); // Return 200 to acknowledge
      }

      // Execute atomic transaction
      await prisma.$transaction(async (tx) => {
        // a) Fetch negotiation to verify it exists
        const negotiation = await tx.negotiation.findUnique({
          where: { id: negotiationId },
          include: {
            merchant: { select: { id: true, email: true } },
            product: { select: { name: true } },
            user: { select: { id: true, email: true } },
          },
        });

        if (!negotiation) {
          console.warn(`Negotiation ${negotiationId} not found`);
          return;
        }

        // b) Update Negotiation status to ACCEPTED (payment confirmed)
        // Note: Status should already be ACCEPTED, but we confirm payment completion here
        await tx.negotiation.update({
          where: { id: negotiationId },
          data: {
            status: "ACCEPTED", // Ensure it stays accepted; could also create Order here
            updatedAt: new Date(),
          },
        });

        // c) Create NegotiationAudit record with PAYMENT_COMPLETED action
        await tx.negotiationAudit.create({
          data: {
            negotiationId,
            action: "PAYMENT_COMPLETED",
            actor: "SYSTEM",
            price: negotiation.approvedPrice || negotiation.requestedPrice || negotiation.originalPrice,
            metadata: {
              razorpayOrderId: orderId,
              razorpayPaymentId: payment.id,
              amount: payment.amount,
              currency: payment.currency,
              timestamp: new Date().toISOString(),
              event: "payment.captured",
            },
          },
        });

        // d) Create Notification for the merchant
        await tx.notification.create({
          data: {
            merchantId: negotiation.merchant.id,
            type: "PAYMENT_RECEIVED",
            title: "Payment Received",
            message: `Payment of ₹${(payment.amount / 100).toLocaleString("en-IN")} received for ${negotiation.product.name} (Qty: ${negotiation.quantity})`,
            resourceType: "NEGOTIATION",
            resourceId: negotiationId,
            actionUrl: `/merchant/negotiations/${negotiationId}`,
            metadata: {
              paymentId: payment.id,
              orderId,
              amount: payment.amount,
              productName: negotiation.product.name,
              buyerEmail: negotiation.user.email,
            },
          },
        });

        console.log(`[Webhook] Payment confirmed for negotiation ${negotiationId}`);
      });

      return NextResponse.json({ status: "ok" });
    }

    // Handle order.paid event (alternative webhook)
    if (event.event === "order.paid") {
      if (!event.payload?.order?.entity) {
        console.warn("Missing order entity in payload");
        return NextResponse.json({ status: "ok" }); // Return 200 to acknowledge
      }

      const order = event.payload.order.entity;
      const receipt = order.receipt; // Format: rcpt_${negotiationId}

      // Parse negotiationId from receipt
      let negotiationId: string | null = null;
      if (receipt?.startsWith("rcpt_")) {
        negotiationId = receipt.substring(5); // Remove "rcpt_" prefix
      }

      if (!negotiationId) {
        console.warn("Could not extract negotiationId from receipt");
        return NextResponse.json({ status: "ok" }); // Return 200 to acknowledge
      }

      // Similar transaction as above
      await prisma.$transaction(async (tx) => {
        const negotiation = await tx.negotiation.findUnique({
          where: { id: negotiationId },
          include: {
            merchant: { select: { id: true, email: true } },
            product: { select: { name: true } },
            user: { select: { id: true, email: true } },
          },
        });

        if (!negotiation) {
          console.warn(`Negotiation ${negotiationId} not found`);
          return;
        }

        await tx.negotiation.update({
          where: { id: negotiationId },
          data: {
            status: "ACCEPTED",
            updatedAt: new Date(),
          },
        });

        await tx.negotiationAudit.create({
          data: {
            negotiationId,
            action: "PAYMENT_COMPLETED",
            actor: "SYSTEM",
            price: negotiation.approvedPrice || negotiation.requestedPrice || negotiation.originalPrice,
            metadata: {
              razorpayOrderId: order.id,
              amount: order.amount,
              currency: order.currency,
              timestamp: new Date().toISOString(),
              event: "order.paid",
            },
          },
        });

        await tx.notification.create({
          data: {
            merchantId: negotiation.merchant.id,
            type: "PAYMENT_RECEIVED",
            title: "Order Paid",
            message: `Order ₹${(order.amount / 100).toLocaleString("en-IN")} for ${negotiation.product.name} has been paid`,
            resourceType: "NEGOTIATION",
            resourceId: negotiationId,
            actionUrl: `/merchant/negotiations/${negotiationId}`,
            metadata: {
              orderId: order.id,
              amount: order.amount,
              productName: negotiation.product.name,
              buyerEmail: negotiation.user.email,
            },
          },
        });

        console.log(`[Webhook] Order paid for negotiation ${negotiationId}`);
      });

      return NextResponse.json({ status: "ok" });
    }

    // Other events: acknowledge without processing
    console.log(`[Webhook] Ignoring event: ${event.event}`);
    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("Webhook handler error:", error);

    // Return 500 to signal Razorpay to retry
    return NextResponse.json(
      {
        error: {
          code: "WEBHOOK_ERROR",
          message: error.message || "Webhook processing failed.",
        },
      },
      { status: 500 }
    );
  }
}

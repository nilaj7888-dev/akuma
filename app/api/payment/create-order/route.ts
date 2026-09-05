import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { razorpay, RAZORPAY_KEY_ID } from "@/lib/razorpay";
import { z } from "zod";

const createOrderSchema = z.object({
  negotiationId: z.string().min(1, "Negotiation ID is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "AKUMA_VALIDATION_ERROR",
            message: "Invalid request body",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { negotiationId } = parsed.data;

    // Get Prisma client
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        {
          error: {
            code: "AKUMA_DATABASE_REQUIRED",
            message: "PostgreSQL is required.",
          },
        },
        { status: 503 }
      );
    }

    // Fetch negotiation with product and buyer details
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      include: {
        product: {
          select: { id: true, name: true, price: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        merchant: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!negotiation) {
      return NextResponse.json(
        {
          error: {
            code: "AKUMA_NOT_FOUND",
            message: "Negotiation not found.",
          },
        },
        { status: 404 }
      );
    }

    // Verify negotiation status is ACCEPTED
    if (negotiation.status !== "ACCEPTED") {
      return NextResponse.json(
        {
          error: {
            code: "AKUMA_INVALID_STATE",
            message: `Negotiation not accepted. Current status: ${negotiation.status}`,
          },
        },
        { status: 400 }
      );
    }

    // Calculate amount in paise from the approved price
    // Use approvedPrice if set (merchant accepted), otherwise requestedPrice (buyer's offer)
    const pricePerUnit = negotiation.approvedPrice || negotiation.requestedPrice || negotiation.originalPrice;
    const totalAmountPaise = Math.round(pricePerUnit * negotiation.quantity);

    if (totalAmountPaise <= 0) {
      return NextResponse.json(
        {
          error: {
            code: "AKUMA_INVALID_AMOUNT",
            message: "Order amount must be greater than zero.",
          },
        },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmountPaise,
      currency: "INR",
      receipt: `rcpt_${negotiationId}`,
      notes: {
        negotiationId,
        productId: negotiation.product.id,
        buyerId: negotiation.user.id,
        merchantId: negotiation.merchant.id,
      },
    });

    if (!razorpayOrder || !razorpayOrder.id) {
      return NextResponse.json(
        {
          error: {
            code: "RAZORPAY_ERROR",
            message: "Failed to create Razorpay order.",
          },
        },
        { status: 500 }
      );
    }

    // Return order details to frontend
    return NextResponse.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: RAZORPAY_KEY_ID,
      negotiationId,
      productName: negotiation.product.name,
      quantity: negotiation.quantity,
      pricePerUnitPaise: pricePerUnit,
      buyerEmail: negotiation.user.email,
      buyerName: negotiation.user.name,
    });
  } catch (error: unknown) {
    console.error("Order creation error:", error);

    return NextResponse.json(
      {
        error: {
          code: "AKUMA_SERVER_ERROR",
          message: (error instanceof Error && error.message) || "Failed to create payment order.",
        },
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } },
        { status: 401 }
      );
    }

    if (session.accountType !== "MERCHANT") {
      return NextResponse.json(
        { error: { code: "AKUMA_FORBIDDEN", message: "Merchants only." } },
        { status: 403 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { error: { code: "AKUMA_DATABASE_REQUIRED", message: "Database required." } },
        { status: 503 }
      );
    }

    const { id } = await params;
    const body = await request.json() as {
      action?: "ACCEPT" | "DECLINE" | "COUNTER";
      counterPrice?: number;
    };

    const { action, counterPrice } = body;

    if (!action || !["ACCEPT", "DECLINE", "COUNTER"].includes(action)) {
      return NextResponse.json(
        { error: { code: "AKUMA_VALIDATION_ERROR", message: "Valid action required: ACCEPT, DECLINE, or COUNTER." } },
        { status: 400 }
      );
    }

    // Get negotiation
    const negotiation = await prisma.negotiation.findUnique({
      where: { id },
      select: {
        id: true,
        merchantId: true,
        userId: true,
        productId: true,
        quantity: true,
        originalPrice: true,
        requestedPrice: true,
        status: true,
        product: { select: { name: true } },
      },
    });

    if (!negotiation) {
      return NextResponse.json(
        { error: { code: "AKUMA_NEGOTIATION_NOT_FOUND", message: "Negotiation not found." } },
        { status: 404 }
      );
    }

    // Verify this merchant owns this negotiation
    if (negotiation.merchantId !== session.userId) {
      return NextResponse.json(
        { error: { code: "AKUMA_FORBIDDEN", message: "You can only respond to your own negotiations." } },
        { status: 403 }
      );
    }

    let newStatus = negotiation.status;
    let updatedNegotiation;

    if (action === "ACCEPT") {
      // Create order with requested price
      const order = await prisma.order.create({
        data: {
          merchantId: negotiation.merchantId,
          consumerId: negotiation.userId,
          amount: negotiation.requestedPrice * negotiation.quantity,
          currency: "INR",
          status: "CREATED",
          source: "NEGOTIATION",
          items: {
            create: {
              productId: negotiation.productId,
              quantity: negotiation.quantity,
              unitPrice: negotiation.requestedPrice,
              total: negotiation.requestedPrice * negotiation.quantity,
            },
          },
        },
      });

      updatedNegotiation = await prisma.negotiation.update({
        where: { id },
        data: {
          status: "ACCEPTED",
          approvedPrice: negotiation.requestedPrice,
        },
        select: {
          id: true,
          status: true,
          approvedPrice: true,
          product: { select: { name: true } },
        },
      });

      return NextResponse.json({
        success: true,
        action: "ACCEPTED",
        negotiation: updatedNegotiation,
        orderId: order.id,
        message: `Order created for ${negotiation.product.name} at ₹${negotiation.requestedPrice / 100}`,
      });
    }

    if (action === "DECLINE") {
      updatedNegotiation = await prisma.negotiation.update({
        where: { id },
        data: {
          status: "REJECTED",
        },
        select: {
          id: true,
          status: true,
          product: { select: { name: true } },
        },
      });

      return NextResponse.json({
        success: true,
        action: "DECLINED",
        negotiation: updatedNegotiation,
        message: `Declined negotiation for ${negotiation.product.name}. Ask AI if customer wants to negotiate further.`,
      });
    }

    if (action === "COUNTER") {
      if (!counterPrice || counterPrice <= 0) {
        return NextResponse.json(
          { error: { code: "AKUMA_VALIDATION_ERROR", message: "Valid counterPrice required." } },
          { status: 400 }
        );
      }

      updatedNegotiation = await prisma.negotiation.update({
        where: { id },
        data: {
          status: "MERCHANT_COUNTER",
          approvedPrice: counterPrice,
        },
        select: {
          id: true,
          status: true,
          approvedPrice: true,
          requestedPrice: true,
          product: { select: { name: true } },
        },
      });

      return NextResponse.json({
        success: true,
        action: "COUNTERED",
        negotiation: updatedNegotiation,
        message: `Counter-offered ₹${counterPrice / 100} for ${negotiation.product.name}. AI will present to customer.`,
      });
    }
  } catch (error) {
    console.error("Merchant negotiation response error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: {
          code: "AKUMA_NEGOTIATION_ERROR",
          message: "Failed to respond to negotiation.",
          detail,
        },
      },
      { status: 500 }
    );
  }
}

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

    if (session.accountType !== "CONSUMER") {
      return NextResponse.json(
        { error: { code: "AKUMA_FORBIDDEN", message: "Consumers only." } },
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
        approvedPrice: true,
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

    // Verify this consumer owns this negotiation
    if (negotiation.userId !== session.userId && negotiation.userId !== session.username) {
      return NextResponse.json(
        { error: { code: "AKUMA_FORBIDDEN", message: "You can only respond to your own negotiations." } },
        { status: 403 }
      );
    }

    let updatedNegotiation;

    if (action === "ACCEPT") {
      // Create order with merchant's counter-offer price
      const finalPrice = negotiation.approvedPrice || negotiation.requestedPrice;
      const order = await prisma.order.create({
        data: {
          merchantId: negotiation.merchantId,
          consumerId: negotiation.userId,
          amount: finalPrice * negotiation.quantity,
          currency: "INR",
          status: "CREATED",
          source: "NEGOTIATION",
          items: {
            create: {
              productId: negotiation.productId,
              quantity: negotiation.quantity,
              unitPrice: finalPrice,
              total: finalPrice * negotiation.quantity,
            },
          },
        },
      });

      updatedNegotiation = await prisma.negotiation.update({
        where: { id },
        data: {
          status: "ACCEPTED",
          approvedPrice: finalPrice,
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
        message: `Order created! You got ${negotiation.product.name} for ₹${finalPrice / 100}`,
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
        message: `Negotiation ended. Maybe try another product?`,
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
          status: "CUSTOMER_OFFER",
          requestedPrice: counterPrice,
        },
        select: {
          id: true,
          status: true,
          requestedPrice: true,
          approvedPrice: true,
          product: { select: { name: true } },
        },
      });

      return NextResponse.json({
        success: true,
        action: "COUNTERED",
        negotiation: updatedNegotiation,
        message: `Counter-offered ₹${counterPrice / 100} for ${negotiation.product.name}. AI will ask the merchant.`,
      });
    }
  } catch (error) {
    console.error("Consumer negotiation response error:", error);
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

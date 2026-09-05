import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
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

    const body = await request.json() as {
      productId?: string;
      quantity?: number;
      requestedPrice?: number;
      merchantId?: string;
    };

    const { productId, quantity = 1, requestedPrice, merchantId } = body;

    if (!productId || !requestedPrice || !merchantId) {
      return NextResponse.json(
        { error: { code: "AKUMA_VALIDATION_ERROR", message: "productId, requestedPrice, and merchantId required." } },
        { status: 400 }
      );
    }

    // Get product to verify it exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, merchantId: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: { code: "AKUMA_PRODUCT_NOT_FOUND", message: "Product not found." } },
        { status: 404 }
      );
    }

    // Create negotiation
    const negotiation = await prisma.negotiation.create({
      data: {
        userId: session.userId || session.username,
        merchantId,
        productId,
        quantity,
        originalPrice: product.price,
        requestedPrice,
        status: "OPEN",
      },
      select: {
        id: true,
        status: true,
        originalPrice: true,
        requestedPrice: true,
        product: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      negotiation,
      message: `Negotiation started for ${negotiation.product.name}`,
    });
  } catch (error) {
    console.error("Negotiation initiate error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: {
          code: "AKUMA_NEGOTIATION_ERROR",
          message: "Failed to initiate negotiation.",
          detail,
        },
      },
      { status: 500 }
    );
  }
}

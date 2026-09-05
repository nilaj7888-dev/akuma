import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

// Applies an AI-recommended price change for real: this is the only route
// that actually writes Product.price. The pricing page must never claim a
// suggested price was "applied" unless this endpoint succeeded.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "Database required." } }, { status: 503 });

  try {
    const body = (await request.json()) as { productId?: string; newPrice?: number };
    const { productId, newPrice } = body;
    if (!productId || typeof newPrice !== "number" || !Number.isFinite(newPrice) || newPrice <= 0) {
      return NextResponse.json({ error: { code: "AKUMA_INVALID_INPUT", message: "productId and a positive newPrice are required." } }, { status: 400 });
    }

    const merchant = await resolveMerchant(prisma, session);
    if (!merchant) return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    const product = await prisma.product.findFirst({ where: { id: productId, merchantId: merchant.id } });
    if (!product) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Product not found." } }, { status: 404 });

    const previousPrice = product.price;
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.product.update({ where: { id: productId }, data: { price: Math.round(newPrice) } });
      await transaction.auditLog.create({
        data: {
          merchantId: merchant.id,
          actorType: "USER",
          actorId: session.username,
          action: "APPLY_PRICE",
          resourceType: "Product",
          resourceId: productId,
          reason: `Applied recommended price change from ₹${(previousPrice / 100).toLocaleString("en-IN")} to ₹${(newPrice / 100).toLocaleString("en-IN")}`,
          input: { previousPrice },
          output: { newPrice: Math.round(newPrice) },
        },
      });
      return result;
    });

    return NextResponse.json({ id: updated.id, price: updated.price });
  } catch (error) {
    console.error("Failed to apply price:", error);
    return NextResponse.json({ error: { code: "AKUMA_INTERNAL", message: "Could not apply the price change." } }, { status: 500 });
  }
}

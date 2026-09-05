import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
});

// PATCH /api/consumer/cart/items/[id] - update item quantity
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer cart only." } }, { status: 403 });

  const parsed = updateItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid quantity." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const { id } = await params;

  // Verify cart item belongs to this user's session
  const cartItem = await prisma.cartItem.findUnique({
    where: { id },
    include: { session: true },
  });

  if (!cartItem) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Cart item not found." } }, { status: 404 });
  if (cartItem.session.userId !== session.userId) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "This item is not in your cart." } }, { status: 403 });
  }

  // Verify product stock
  const product = await prisma.product.findUnique({
    where: { id: cartItem.productId },
    select: { stock: true, active: true },
  });

  if (!product || !product.active) {
    return NextResponse.json({ error: { code: "AKUMA_UNAVAILABLE", message: "Product is not available." } }, { status: 400 });
  }
  if (product.stock < parsed.data.quantity) {
    return NextResponse.json({ error: { code: "AKUMA_INSUFFICIENT_STOCK", message: "Insufficient stock." } }, { status: 400 });
  }

  const updated = await prisma.cartItem.update({
    where: { id },
    data: { quantity: parsed.data.quantity },
  });

  return NextResponse.json({
    id: updated.id,
    productId: updated.productId,
    quantity: updated.quantity,
  });
}

// DELETE /api/consumer/cart/items/[id] - remove item from cart
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer cart only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const { id } = await params;

  // Verify cart item belongs to this user's session
  const cartItem = await prisma.cartItem.findUnique({
    where: { id },
    include: { session: true },
  });

  if (!cartItem) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Cart item not found." } }, { status: 404 });
  if (cartItem.session.userId !== session.userId) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "This item is not in your cart." } }, { status: 403 });
  }

  await prisma.cartItem.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const addItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});

// GET /api/consumer/cart/items - get cart items
export async function GET() {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer cart only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get or create shopping session
  let shoppingSession = await prisma.shoppingSession.findFirst({
    where: { userId: session.userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  if (!shoppingSession) {
    shoppingSession = await prisma.shoppingSession.create({
      data: { userId: session.userId },
      include: { items: true },
    });
  }

  // Fetch product details for cart items
  const productIds = shoppingSession.items.map(item => item.productId);
  const products = productIds.length > 0 ? await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { merchant: { select: { name: true } } },
  }) : [];
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  const items = shoppingSession.items.map(item => {
    const product = productMap[item.productId];
    return {
      id: item.id,
      productId: item.productId,
      productName: product?.name ?? "Unknown",
      quantity: item.quantity,
      unitPricePaise: product?.price ?? 0,
      unitPriceDisplay: product ? `₹${(product.price / 100).toLocaleString("en-IN")}` : "N/A",
      totalPaise: product ? product.price * item.quantity : 0,
      totalDisplay: product ? `₹${((product.price * item.quantity) / 100).toLocaleString("en-IN")}` : "N/A",
      stock: product?.stock ?? 0,
      available: product ? product.active && product.stock >= item.quantity : false,
      merchantName: product?.merchant.name ?? "Unknown",
      addedAt: item.addedAt,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.totalPaise, 0);

  return NextResponse.json({
    items,
    subtotalPaise: subtotal,
    subtotalDisplay: `₹${(subtotal / 100).toLocaleString("en-IN")}`,
    count: items.length,
  });
}

// POST /api/consumer/cart/items - add item to cart
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer cart only." } }, { status: 403 });

  const parsed = addItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid item data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Verify product exists and is available
  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, price: true, stock: true, active: true },
  });

  if (!product) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Product not found." } }, { status: 404 });
  if (!product.active) return NextResponse.json({ error: { code: "AKUMA_UNAVAILABLE", message: "Product is not available." } }, { status: 400 });
  if (product.stock < parsed.data.quantity) return NextResponse.json({ error: { code: "AKUMA_INSUFFICIENT_STOCK", message: "Insufficient stock." } }, { status: 400 });

  // Get or create shopping session
  let shoppingSession = await prisma.shoppingSession.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  if (!shoppingSession) {
    shoppingSession = await prisma.shoppingSession.create({
      data: { userId: session.userId },
    });
  }

  // Add or update cart item
  const cartItem = await prisma.cartItem.upsert({
    where: {
      sessionId_productId: {
        sessionId: shoppingSession.id,
        productId: parsed.data.productId,
      },
    },
    update: {
      quantity: { increment: parsed.data.quantity },
    },
    create: {
      sessionId: shoppingSession.id,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
    },
  });

  return NextResponse.json({
    id: cartItem.id,
    productId: cartItem.productId,
    quantity: cartItem.quantity,
  });
}

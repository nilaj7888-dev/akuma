import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const wishlistItemSchema = z.object({
  productId: z.string(),
  name: z.string().optional(),
  note: z.string().optional(),
  alertPrice: z.number().optional(),
  alertActive: z.boolean().optional(),
});

const wishlistQuerySchema = z.object({
  withRecommendations: z.string().transform(v => v === "true").optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// GET /api/consumer/wishlist - get consumer's wishlist
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const url = new URL(request.url);
    const parsed = wishlistQuerySchema.safeParse({
      withRecommendations: url.searchParams.get("withRecommendations") || undefined,
      limit: url.searchParams.get("limit") || "20",
      offset: url.searchParams.get("offset") || "0",
    });

    if (!parsed.success)
      return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid query params." } }, { status: 400 });

    const { limit, offset, withRecommendations } = parsed.data;

    const wishlistRows = await prisma.$queryRaw`
      SELECT w.*, p.name as product_name, p.sku as product_sku, p.price as product_price,
             p."avgRating" as avg_rating, p."totalReviews" as total_reviews, p."merchantId" as product_merchant_id
      FROM "Wishlist" w
      JOIN "Product" p ON w."productId" = p.id
      WHERE w."userId" = ${session.userId}
      ORDER BY w."createdAt" DESC
      LIMIT ${Math.min(limit || 20, 50)}
      OFFSET ${offset || 0}
    ` as any[];

    const total = await prisma.wishlist.count({ where: { userId: session.userId } });

    const wishlistWithStatus = wishlistRows.map((item: any) => ({
      id: item.id,
      userId: item.userId,
      productId: item.productId,
      name: item.name,
      note: item.note,
      alertPrice: item.alertPrice,
      alertActive: item.alertActive,
      createdAt: item.createdAt,
      product: {
        id: item.productId,
        name: item.product_name,
        sku: item.product_sku,
        price: item.product_price,
        priceDisplay: `₹${(item.product_price / 100).toLocaleString("en-IN")}`,
        avgRating: item.avg_rating,
        totalReviews: item.total_reviews,
        merchantId: item.product_merchant_id,
        alertActive: item.alertActive,
        isOnSale: false,
        priceDrop: 0,
      },
    }));

    // Get recommendations based on wishlist
    let recommendations: any[] = [];
    if (withRecommendations && wishlistWithStatus.length > 0) {
      const productIds = wishlistWithStatus.map((item: any) => item.productId);
      const merchantIds = [...new Set(wishlistWithStatus.map((item: any) => item.product.merchantId))];

      if (merchantIds.length > 0) {
        const products = await prisma.product.findMany({
          where: {
            merchantId: { in: merchantIds },
            active: true,
            id: { notIn: productIds },
          },
          include: { merchant: { select: { name: true, email: true } } },
          take: 10,
        });

        recommendations = products.map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price,
          priceDisplay: `₹${(p.price / 100).toLocaleString("en-IN")}`,
          avgRating: p.avgRating,
          totalReviews: p.totalReviews,
          merchantName: p.merchant?.name,
        }));
      }
    }

    return NextResponse.json({
      wishlist: wishlistWithStatus,
      recommendations,
      pagination: { total, limit: limit || 20, offset: offset || 0, hasMore: (offset || 0) + (limit || 20) < total },
    });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch wishlist." } }, { status: 500 });
  }
}

// POST /api/consumer/wishlist - add item to wishlist
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const parsed = wishlistItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid wishlist item data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: parsed.data.productId },
    });

    if (!product)
      return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Product not found." } }, { status: 404 });

    // Check if already in wishlist
    const existing = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId: session.userId, productId: parsed.data.productId } },
    });

    if (existing)
      return NextResponse.json({ error: { code: "AKUMA_DUPLICATE", message: "Product already in wishlist." } }, { status: 400 });

    const wishlistItem = await prisma.wishlist.create({
      data: {
        userId: session.userId,
        productId: parsed.data.productId,
        name: parsed.data.name,
        note: parsed.data.note,
        alertPrice: parsed.data.alertPrice,
        alertActive: parsed.data.alertActive ?? true,
      },
    });

    return NextResponse.json({ wishlistItem }, { status: 201 });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    return NextResponse.json({ error: { code: "AKUMA_CREATE_ERROR", message: "Failed to add to wishlist." } }, { status: 500 });
  }
}

// DELETE /api/consumer/wishlist - remove item from wishlist
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const { productId } = await request.json().catch(() => ({ productId: null }));
    if (!productId)
      return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Product ID is required." } }, { status: 400 });

    await prisma.wishlist.delete({
      where: { userId_productId: { userId: session.userId, productId } },
    });

    return NextResponse.json({ success: true, message: "Removed from wishlist." });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    return NextResponse.json({ error: { code: "AKUMA_DELETE_ERROR", message: "Failed to remove from wishlist." } }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const reviewSchema = z.object({
  productId: z.string(),
  rating: z.enum(["ONE", "TWO", "THREE", "FOUR", "FIVE"]),
  title: z.string().optional(),
  comment: z.string().optional(),
  images: z.array(z.string()).optional(),
});

// GET /api/consumer/reviews - get consumer's reviews
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
    const reviews = await prisma.review.findMany({
      where: { consumerId: session.userId },
      include: { product: { select: { id: true, name: true, sku: true, price: true, merchantId: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch reviews." } }, { status: 500 });
  }
}

// POST /api/consumer/reviews - create a review
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid review data." } }, { status: 400 });

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

    // Check if already reviewed
    const existing = await prisma.review.findFirst({
      where: { consumerId: session.userId, productId: parsed.data.productId },
    });

    if (existing)
      return NextResponse.json({ error: { code: "AKUMA_DUPLICATE", message: "You have already reviewed this product." } }, { status: 400 });

    // Check if verified purchase (has completed order)
    const verifiedOrder = await prisma.order.findFirst({
      where: {
        consumerId: session.userId,
        items: { some: { productId: parsed.data.productId } },
        status: "COMPLETED",
      },
    });

    const review = await prisma.review.create({
      data: {
        productId: parsed.data.productId,
        consumerId: session.userId,
        merchantId: product.merchantId,
        rating: parsed.data.rating,
        title: parsed.data.title,
        comment: parsed.data.comment,
        images: parsed.data.images || [],
        verified: !!verifiedOrder,
      },
    });

    // Update product rating
    const allReviews = await prisma.review.findMany({
      where: { productId: parsed.data.productId, status: "PUBLISHED" },
      select: { rating: true },
    });

    const ratingMap: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    const avgRating = allReviews.reduce((sum, r) => sum + ratingMap[r.rating], 0) / allReviews.length;

    await prisma.product.update({
      where: { id: parsed.data.productId },
      data: { avgRating: Math.round(avgRating * 10) / 10, totalReviews: allReviews.length },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Error creating review:", error);
    return NextResponse.json({ error: { code: "AKUMA_CREATE_ERROR", message: "Failed to create review." } }, { status: 500 });
  }
}
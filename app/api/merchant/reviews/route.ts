import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";
import { z } from "zod";

const reviewQuerySchema = z.object({
  productId: z.string().optional(),
  status: z.string().optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

const responseSchema = z.object({
  reviewId: z.string(),
  response: z.string().min(1).max(1000),
});

// GET /api/merchant/reviews - get merchant's reviews
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const url = new URL(request.url);
    const parsed = reviewQuerySchema.safeParse({
      productId: url.searchParams.get("productId") || undefined,
      status: url.searchParams.get("status") || undefined,
      limit: url.searchParams.get("limit") || "20",
      offset: url.searchParams.get("offset") || "0",
    });

    if (!parsed.success)
      return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid query params." } }, { status: 400 });

    const merchant = await resolveMerchant(prisma, session);

    if (!merchant)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    const { productId, status, limit, offset } = parsed.data;

    const where: any = { merchantId: merchant.id };
    if (productId) where.productId = productId;
    if (status) where.status = status;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit || 20, 50),
        skip: offset || 0,
      }),
      prisma.review.count({ where }),
    ]);

    // Calculate rating distribution
    const ratingGroups = await prisma.review.groupBy({
      by: ["rating"],
      where: { merchantId: merchant.id, status: "PUBLISHED" },
      _count: true,
    });

    const distribution: Record<string, number> = { ONE: 0, TWO: 0, THREE: 0, FOUR: 0, FIVE: 0 };
    ratingGroups.forEach(g => { distribution[g.rating] = g._count; });

    return NextResponse.json({
      reviews,
      distribution,
      pagination: { total, limit: limit || 20, offset: offset || 0, hasMore: (offset || 0) + (limit || 20) < total },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch reviews." } }, { status: 500 });
  }
}

// POST /api/merchant/reviews - respond to a review
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const parsed = responseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid response data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    const review = await prisma.review.findUnique({
      where: { id: parsed.data.reviewId },
    });

    if (!review || review.merchantId !== merchant.id)
      return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Review not found." } }, { status: 404 });

    const updated = await prisma.review.update({
      where: { id: parsed.data.reviewId },
      data: { response: parsed.data.response, respondedAt: new Date() },
    });

    return NextResponse.json({ review: updated });
  } catch (error) {
    console.error("Error responding to review:", error);
    return NextResponse.json({ error: { code: "AKUMA_UPDATE_ERROR", message: "Failed to respond to review." } }, { status: 500 });
  }
}
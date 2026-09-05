import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { findMatchingProductsForBuyer } from "@/lib/product-matching";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer catalog only." } }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  // Personalized "matched to your requirements" feed. Off by default so the
  // general catalog response is unchanged for callers that don't ask for it.
  const withMatches = searchParams.get("matches") === "1";

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const where: Record<string, unknown> = { active: true };
  if (category) {
    where.category = category;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        stock: true,
        description: true,
        metadata: true,
        merchant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.product.count({ where }),
  ]);

  // When requested, add products that match THIS buyer's stated requirements
  // (their OPEN BuyerInterests), scored by the shared product-matching logic.
  // Scoped to session.userId, so a buyer only ever sees their own matches.
  let matches: Array<Record<string, unknown>> = [];
  if (withMatches && session.userId) {
    const buyerMatches = await findMatchingProductsForBuyer(prisma, session.userId, { limit: 12 });
    matches = buyerMatches.map((m) => ({
      id: m.productId,
      name: m.name,
      category: m.category,
      pricePaise: m.price,
      priceDisplay: `₹${(m.price / 100).toLocaleString("en-IN")}`,
      stock: m.stock,
      available: m.stock > 0,
      description: m.description,
      merchantName: m.merchantName,
      matchScore: m.matchScore,
      matchReasons: m.matchReasons,
    }));
  }

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      pricePaise: p.price,
      priceDisplay: `₹${(p.price / 100).toLocaleString("en-IN")}`,
      stock: p.stock,
      available: p.stock > 0,
      description: p.description,
      merchantName: p.merchant.name,
      metadata: p.metadata,
    })),
    matches,
    pagination: { limit, offset, total },
  });
}

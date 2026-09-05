import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer catalog search only." } }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase() ?? "";
  const category = searchParams.get("category") ?? undefined;
  const minPrice = searchParams.get("min") ? parseInt(searchParams.get("min")!, 10) : undefined;
  const maxPrice = searchParams.get("max") ? parseInt(searchParams.get("max")!, 10) : undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const where: Record<string, unknown> = { active: true };

  if (category) {
    where.category = category;
  }

  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) (where.price as Record<string, unknown>).gte = minPrice;
    if (maxPrice) (where.price as Record<string, unknown>).lte = maxPrice;
  }

  if (query) {
    const searchQuery = {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    };
    Object.assign(where, searchQuery);
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
        merchant: { select: { name: true, email: true } },
      },
      orderBy: { stock: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.product.count({ where }),
  ]);

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
    })),
    pagination: { limit, offset, total },
  });
}

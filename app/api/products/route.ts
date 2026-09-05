import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { catalogSearch } from "@/lib/domain";

export async function GET(request: Request) {
  if (!await getSession()) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  const query = new URL(request.url).searchParams.get("query") ?? "";
  const prisma = getPrisma();
  if (prisma) {
    const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
    if (!merchant) return NextResponse.json([]);
    const products = await prisma.product.findMany({ where: { merchantId: merchant.id, active: true, stock: { gt: 0 }, OR: query.trim() ? [{ name: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] : undefined }, orderBy: { name: "asc" } });
    return NextResponse.json(products.map((product) => ({ id: product.id, name: product.name, category: product.category, price: product.price / 100, stock: product.stock })));
  }
  return NextResponse.json(catalogSearch(query));
}

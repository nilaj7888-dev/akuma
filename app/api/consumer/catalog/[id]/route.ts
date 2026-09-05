import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer catalog only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      price: true,
      cost: true,
      stock: true,
      active: true,
      metadata: true,
      merchant: { select: { name: true, email: true } },
      createdAt: true,
    },
  });

  if (!product) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Product not found." } }, { status: 404 });

  return NextResponse.json({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    pricePaise: product.price,
    priceDisplay: `₹${(product.price / 100).toLocaleString("en-IN")}`,
    costPaise: product.cost,
    marginPercent: Math.round(((product.price - product.cost) / product.price) * 100),
    stock: product.stock,
    available: product.active && product.stock > 0,
    metadata: product.metadata,
    merchant: {
      name: product.merchant.name,
      email: product.merchant.email,
    },
    createdAt: product.createdAt,
  });
}

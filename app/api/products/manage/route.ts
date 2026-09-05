import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const selectionSchema = z.object({ productIds: z.array(z.string().min(1)).max(1000) });

async function merchantForSession() {
  const prisma = getPrisma();
  if (!prisma) return { prisma: null, merchant: null };
  const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
  return { prisma, merchant };
}

export async function GET() {
  if (!await getSession()) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  const { prisma, merchant } = await merchantForSession();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required for product review." } }, { status: 503 });
  if (!merchant) return NextResponse.json([]);
  const products = await prisma.product.findMany({ where: { merchantId: merchant.id }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  return NextResponse.json(products.map((product) => ({ id: product.id, name: product.name, description: product.description, category: product.category, price: product.price / 100, stock: product.stock, status: product.active ? "ACTIVE" : "PENDING_REVIEW", source: product.metadata && typeof product.metadata === "object" && "source" in product.metadata ? product.metadata.source : "MANUAL", sourceUrl: product.metadata && typeof product.metadata === "object" && "sourceUrl" in product.metadata ? product.metadata.sourceUrl : null, image: product.metadata && typeof product.metadata === "object" && "image" in product.metadata ? product.metadata.image : null })));
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.role !== "OWNER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Only the merchant owner can activate products." } }, { status: 403 });
  const parsed = selectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Choose valid products to activate." } }, { status: 400 });
  const { prisma, merchant } = await merchantForSession();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required for product review." } }, { status: 503 });
  if (!merchant) return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant workspace is not configured." } }, { status: 404 });
  await prisma.product.updateMany({ where: { merchantId: merchant.id }, data: { active: false } });
  await prisma.product.updateMany({ where: { merchantId: merchant.id, id: { in: parsed.data.productIds } }, data: { active: true } });
  await prisma.auditLog.create({ data: { merchantId: merchant.id, actorType: "USER", action: "Products activated", resourceType: "Product", reason: `${parsed.data.productIds.length} products selected for AKUMA recommendations`, output: { productIds: parsed.data.productIds } } });
  return NextResponse.json({ activated: parsed.data.productIds.length });
}

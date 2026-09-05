import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const negotiationRequestSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  requestedPricePaise: z.number().int().positive().optional(),
});

// POST /api/consumer/negotiation - request negotiation
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer negotiation only." } }, { status: 403 });

  const parsed = negotiationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid negotiation request." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get product
  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { merchantId: true, price: true, stock: true },
  });

  if (!product) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Product not found." } }, { status: 404 });
  if (product.stock < parsed.data.quantity) return NextResponse.json({ error: { code: "AKUMA_INSUFFICIENT_STOCK", message: "Insufficient stock for requested quantity." } }, { status: 400 });

  // Get merchant policy
  const policy = await prisma.policy.findUnique({ where: { merchantId: product.merchantId } });

  // Create negotiation record
  const negotiation = await prisma.negotiation.create({
    data: {
      userId: session.userId,
      merchantId: product.merchantId,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
      originalPrice: product.price,
      requestedPrice: parsed.data.requestedPricePaise,
      status: "OPEN",
      merchantApprovalRequired: policy && parsed.data.requestedPricePaise ?
        Math.round((1 - parsed.data.requestedPricePaise / product.price) * 100) > (policy.maxDiscountPercent ?? 10) :
        false,
    },
  });

  return NextResponse.json({
    id: negotiation.id,
    status: negotiation.status,
    productId: negotiation.productId,
    quantity: negotiation.quantity,
    originalPricePaise: negotiation.originalPrice,
    originalPriceDisplay: `₹${(negotiation.originalPrice / 100).toLocaleString("en-IN")}`,
    requestedPricePaise: negotiation.requestedPrice,
    requestedPriceDisplay: negotiation.requestedPrice ? `₹${(negotiation.requestedPrice / 100).toLocaleString("en-IN")}` : null,
    merchantApprovalRequired: negotiation.merchantApprovalRequired,
    createdAt: negotiation.createdAt,
  });
}

// GET /api/consumer/negotiation - list consumer's negotiations
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer negotiation only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const negotiations = await prisma.negotiation.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  // Enrich with product/merchant names
  const productIds = [...new Set(negotiations.map(n => n.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, merchantId: true },
  });
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  const merchantIds = [...new Set(products.map(p => p.merchantId))];
  const merchants = await prisma.merchant.findMany({
    where: { id: { in: merchantIds } },
    select: { id: true, name: true },
  });
  const merchantMap = Object.fromEntries(merchants.map(m => [m.id, m]));

  return NextResponse.json({
    negotiations: negotiations.map(n => {
      const product = productMap[n.productId];
      const merchant = product ? merchantMap[product.merchantId] : null;
      return {
        id: n.id,
        status: n.status,
        productId: n.productId,
        productName: product?.name,
        merchantName: merchant?.name,
        quantity: n.quantity,
        originalPricePaise: n.originalPrice,
        originalPriceDisplay: `₹${(n.originalPrice / 100).toLocaleString("en-IN")}`,
        requestedPricePaise: n.requestedPrice,
        requestedPriceDisplay: n.requestedPrice ? `₹${(n.requestedPrice / 100).toLocaleString("en-IN")}` : null,
        approvedPricePaise: n.approvedPrice,
        approvedPriceDisplay: n.approvedPrice ? `₹${(n.approvedPrice / 100).toLocaleString("en-IN")}` : null,
        merchantApprovalRequired: n.merchantApprovalRequired,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      };
    }),
  });
}

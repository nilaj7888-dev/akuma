import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const negotiationResponseSchema = z.object({
  decision: z.enum(["APPROVE", "COUNTER", "REJECT"]),
  counterPrice: z.number().int().positive().optional(),
  reason: z.string().optional(),
});

// GET /api/merchant/negotiation - list pending negotiations for merchant
export async function GET() {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get merchant ID from authenticated user
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { merchantId: true },
  });

  if (!user || !user.merchantId) return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

  const negotiations = await prisma.negotiation.findMany({
    where: {
      merchantId: user.merchantId,
      status: { in: ["OPEN", "CUSTOMER_OFFER", "AI_COUNTER"] },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch product details
  const productIds = [...new Set(negotiations.map(n => n.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  // Get policy
  const policy = await prisma.policy.findUnique({
    where: { merchantId: user.merchantId },
  });

  return NextResponse.json({
    negotiations: negotiations.map(n => {
      const product = productMap[n.productId];
      const discountPercent = n.requestedPrice
        ? Math.round((1 - n.requestedPrice / n.originalPrice) * 100)
        : 0;
      return {
        id: n.id,
        productId: n.productId,
        productName: product?.name,
        quantity: n.quantity,
        originalPricePaise: n.originalPrice,
        originalPriceDisplay: `₹${(n.originalPrice / 100).toLocaleString("en-IN")}`,
        requestedPricePaise: n.requestedPrice,
        requestedPriceDisplay: n.requestedPrice ? `₹${(n.requestedPrice / 100).toLocaleString("en-IN")}` : null,
        discountPercent,
        totalValuePaise: n.originalPrice * n.quantity,
        totalValueDisplay: `₹${((n.originalPrice * n.quantity) / 100).toLocaleString("en-IN")}`,
        status: n.status,
        merchantApprovalRequired: n.merchantApprovalRequired,
        createdAt: n.createdAt,
        policy: {
          maxDiscountPercent: policy?.maxDiscountPercent,
          minimumMarginPercent: policy?.minimumMarginPercent,
        },
      };
    }),
  });
}


import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const { id: productId } = await params;

  // Get product
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, category: true, price: true },
  });

  if (!product) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Product not found." } }, { status: 404 });

  // Get all orders containing this product and their customers
  const orderItems = await prisma.orderItem.findMany({
    where: { productId },
    include: {
      order: {
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              segment: true,
              lifetimeValue: true,
            },
          },
        },
      },
    },
    take: 100,
  });

  // Analyze customer segments
  const segments: Record<string, { count: number; totalValue: number; customers: string[] }> = {};
  const segmentNames = ["VIP", "LOYAL", "ACTIVE", "NEW", "AT_RISK", "DORMANT"];

  orderItems.forEach((item) => {
    if (item.order.customer) {
      const seg = item.order.customer.segment || "UNKNOWN";
      if (!segments[seg]) {
        segments[seg] = { count: 0, totalValue: 0, customers: [] };
      }
      segments[seg].count++;
      segments[seg].totalValue += item.order.customer.lifetimeValue || 0;
      if (!segments[seg].customers.includes(item.order.customer.id)) {
        segments[seg].customers.push(item.order.customer.id);
      }
    }
  });

  // Get related products (bought together)
  const relatedProductIds: Record<string, number> = {};
  orderItems.forEach((item) => {
    if (item.order.id) {
      // Find other items in same order
      prisma.orderItem
        .findMany({
          where: { orderId: item.order.id, productId: { not: productId } },
          select: { productId: true },
        })
        .then((others) => {
          others.forEach((o) => {
            relatedProductIds[o.productId] = (relatedProductIds[o.productId] || 0) + 1;
          });
        });
    }
  });

  const topRelated = Object.entries(relatedProductIds)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id);

  const relatedProducts = topRelated.length > 0 ? await prisma.product.findMany({ where: { id: { in: topRelated } } }) : [];

  return NextResponse.json({
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      priceDisplay: `₹${(product.price / 100).toLocaleString("en-IN")}`,
    },
    segments: Object.entries(segments).map(([name, data]) => ({
      segment: name,
      customerCount: data.customers.length,
      uniquePurchases: data.count,
      totalLifetimeValue: data.totalValue,
      totalLifetimeValueDisplay: `₹${(data.totalValue / 100).toLocaleString("en-IN")}`,
      averageValue: data.customers.length > 0 ? Math.round(data.totalValue / data.customers.length) : 0,
      averageValueDisplay: `₹${Math.round(data.totalValue / (data.customers.length || 1)) / 100}`,
    })),
    frequentlyBoughtTogether: relatedProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      priceDisplay: `₹${(p.price / 100).toLocaleString("en-IN")}`,
      coOccurrences: relatedProductIds[p.id],
    })),
    recommendation: {
      bestTargetSegment: Object.entries(segments).sort(([, a], [, b]) => (b.totalValue || 0) - (a.totalValue || 0))[0]?.[0],
      bundlingOpportunity: relatedProducts.length > 0,
      crossSellProducts: relatedProducts.slice(0, 3),
    },
  });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// GET /api/merchant/analytics/trending - get trending products
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
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { merchantId: true },
    });

    if (!user || !user.merchantId)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previous7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get order items for last 7 days
    const recentItems = await prisma.orderItem.findMany({
      where: {
        order: {
          merchantId: user.merchantId,
          status: { in: ["PAID", "PROCESSING", "COMPLETED"] as any },
          createdAt: { gte: last7Days },
        },
      },
      include: { product: true },
    });

    // Get order items for previous 7 days
    const previousItems = await prisma.orderItem.findMany({
      where: {
        order: {
          merchantId: user.merchantId,
          status: { in: ["PAID", "PROCESSING", "COMPLETED"] as any },
          createdAt: { gte: previous7Days, lt: last7Days },
        },
      },
    });

    // Calculate recent sales by product
    const recentSales = recentItems.reduce((acc, item) => {
      if (!acc[item.productId]) {
        acc[item.productId] = { quantity: 0, revenue: 0, product: item.product };
      }
      acc[item.productId].quantity += item.quantity;
      acc[item.productId].revenue += item.total;
      return acc;
    }, {} as Record<string, any>);

    // Calculate previous sales by product
    const previousSales = previousItems.reduce((acc, item) => {
      if (!acc[item.productId]) acc[item.productId] = 0;
      acc[item.productId] += item.quantity;
      return acc;
    }, {} as Record<string, number>);

    // Calculate growth and identify trending products
    const trendingProducts = Object.entries(recentSales)
      .map(([productId, data]: [string, any]) => {
        const previousQty = previousSales[productId] || 0;
        const growth = previousQty > 0
          ? Math.round(((data.quantity - previousQty) / previousQty) * 100)
          : data.quantity > 0 ? 100 : 0;

        return {
          productId,
          productName: data.product.name,
          sku: data.product.sku,
          category: data.product.category,
          recentQuantity: data.quantity,
          previousQuantity: previousQty,
          revenue: data.revenue,
          revenueDisplay: `₹${(data.revenue / 100).toLocaleString("en-IN")}`,
          growth,
          trend: growth > 20 ? "up" : growth < -20 ? "down" : "stable",
        };
      })
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 10);

    // Get buyer interest trends
    const recentInterests = await prisma.buyerInterest.findMany({
      where: {
        merchantId: user.merchantId,
        createdAt: { gte: last7Days },
      },
      include: { product: true },
    });

    const interestsByProduct = recentInterests.reduce((acc, interest) => {
      if (!acc[interest.productId]) {
        acc[interest.productId] = { count: 0, product: interest.product };
      }
      acc[interest.productId].count += 1;
      return acc;
    }, {} as Record<string, any>);

    const topInterests = Object.values(interestsByProduct)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5)
      .map((item: any) => ({
        productId: item.product.id,
        productName: item.product.name,
        interestCount: item.count,
      }));

    return NextResponse.json({
      trending: trendingProducts,
      topInterests,
      period: {
        recent: { start: last7Days, end: now },
        previous: { start: previous7Days, end: last7Days },
      },
    });
  } catch (error) {
    console.error("Error fetching trending products:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch trending products." } }, { status: 500 });
  }
}
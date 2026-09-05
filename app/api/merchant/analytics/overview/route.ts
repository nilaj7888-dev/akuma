import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";

// GET /api/merchant/analytics/overview - merchant analytics overview
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

    // Date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total revenue (last 30 days)
    const orders = await prisma.order.findMany({
      where: {
        merchantId: user.merchantId,
        status: { in: ["PAID", "PROCESSING", "COMPLETED"] as OrderStatus[] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { amount: true, createdAt: true },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
    const last7DaysRevenue = orders
      .filter(o => o.createdAt >= sevenDaysAgo)
      .reduce((sum, o) => sum + o.amount, 0);

    // Orders count
    const totalOrders = orders.length;
    const last7DaysOrders = orders.filter(o => o.createdAt >= sevenDaysAgo).length;

    // Average order value
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Top products (by revenue)
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          merchantId: user.merchantId,
          status: { in: ["PAID", "PROCESSING", "COMPLETED"] as OrderStatus[] },
          createdAt: { gte: thirtyDaysAgo },
        },
      },
      include: { product: { select: { id: true, name: true, sku: true, price: true } } },
    });

    interface ProductRevenueEntry {
      product: { id: string; name: string; sku: string; price: number };
      revenue: number;
      quantity: number;
    }

    const productRevenue = orderItems.reduce((acc, item) => {
      if (!acc[item.productId]) {
        acc[item.productId] = {
          product: item.product,
          revenue: 0,
          quantity: 0,
        };
      }
      acc[item.productId].revenue += item.total;
      acc[item.productId].quantity += item.quantity;
      return acc;
    }, {} as Record<string, ProductRevenueEntry>);

    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({
        productId: p.product.id,
        productName: p.product.name,
        revenue: p.revenue,
        revenueDisplay: `₹${(p.revenue / 100).toLocaleString("en-IN")}`,
        quantity: p.quantity,
      }));

    // Buyer interests summary
    const buyerInterests = await prisma.buyerInterest.findMany({
      where: {
        merchantId: user.merchantId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const pendingInterests = buyerInterests.filter(i => ["OPEN", "REVIEWING", "OFFER_MADE"].includes(i.status)).length;
    const convertedInterests = buyerInterests.filter(i => i.status === "CONVERTED_TO_ORDER").length;

    // Low stock products
    const lowStockProducts = await prisma.product.findMany({
      where: {
        merchantId: user.merchantId,
        active: true,
        stock: { lte: 10 },
      },
      orderBy: { stock: "asc" },
      take: 5,
    });

    return NextResponse.json({
      overview: {
        revenue: {
          total: totalRevenue,
          totalDisplay: `₹${(totalRevenue / 100).toLocaleString("en-IN")}`,
          last7Days: last7DaysRevenue,
          last7DaysDisplay: `₹${(last7DaysRevenue / 100).toLocaleString("en-IN")}`,
          growth: last7DaysRevenue > 0 ? Math.round(((last7DaysRevenue / (totalRevenue - last7DaysRevenue)) - 1) * 100) : 0,
        },
        orders: {
          total: totalOrders,
          last7Days: last7DaysOrders,
          avgValue: avgOrderValue,
          avgValueDisplay: `₹${(avgOrderValue / 100).toLocaleString("en-IN")}`,
        },
        buyerInterests: {
          pending: pendingInterests,
          converted: convertedInterests,
          conversionRate: buyerInterests.length > 0 ? Math.round((convertedInterests / buyerInterests.length) * 100) : 0,
        },
      },
      topProducts,
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        price: p.price,
        priceDisplay: `₹${(p.price / 100).toLocaleString("en-IN")}`,
      })),
      period: {
        start: thirtyDaysAgo,
        end: now,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch analytics." } }, { status: 500 });
  }
}
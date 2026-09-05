import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required.", 401);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!query || query.length < 2) {
    return apiError("VALIDATION_ERROR", "Search query must be at least 2 characters.", 400);
  }

  const prisma = getPrisma();
  if (!prisma) return apiError("DATABASE_UNAVAILABLE", "Database connection required.", 503);

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return apiError("NOT_FOUND", "Merchant not found.", 404);

    const searchTerm = `%${query.toLowerCase()}%`;

    // Search products
    const products = await prisma.product.findMany({
      where: {
        merchantId: merchant.id,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        stock: true,
      },
    });

    // Search customers
    const customers = await prisma.customer.findMany({
      where: {
        merchantId: merchant.id,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        segment: true,
        lifetimeValue: true,
      },
    });

    // Search orders
    const orders = await prisma.order.findMany({
      where: {
        merchantId: merchant.id,
        razorpayOrderId: { contains: query, mode: "insensitive" },
      },
      take: limit,
      select: {
        id: true,
        razorpayOrderId: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    });

    // Search campaigns
    const campaigns = await prisma.campaign.findMany({
      where: {
        merchantId: merchant.id,
        name: { contains: query, mode: "insensitive" },
      },
      take: limit,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        expectedRevenue: true,
      },
    });

    return apiSuccess({
      query,
      results: {
        products: products.map((p) => ({
          ...p,
          type: "product" as const,
          priceDisplay: `₹${(p.price / 100).toLocaleString("en-IN")}`,
        })),
        customers: customers.map((c) => ({
          ...c,
          type: "customer" as const,
          lifetimeValueDisplay: `₹${(c.lifetimeValue / 100).toLocaleString("en-IN")}`,
        })),
        orders: orders.map((o) => ({
          ...o,
          type: "order" as const,
          amountDisplay: `₹${(o.amount / 100).toLocaleString("en-IN")}`,
        })),
        campaigns: campaigns.map((c) => ({
          ...c,
          type: "campaign" as const,
          expectedRevenueDisplay: `₹${(c.expectedRevenue / 100).toLocaleString("en-IN")}`,
        })),
      },
      total:
        products.length + customers.length + orders.length + campaigns.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return apiError("INTERNAL_ERROR", "Search failed.", 500);
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";
import { z } from "zod";
import type { Prisma, OrderStatus } from "@prisma/client";

const ordersQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// GET /api/merchant/orders - list all merchant orders
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
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    const url = new URL(request.url);
    const parsed = ordersQuerySchema.safeParse({
      status: url.searchParams.get("status"),
      limit: url.searchParams.get("limit") || "50",
      offset: url.searchParams.get("offset") || "0",
    });

    if (!parsed.success)
      return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid query params." } }, { status: 400 });

    const { status, limit, offset } = parsed.data;

    const where: Prisma.OrderWhereInput = { merchantId: merchant.id };
    if (status) where.status = status as OrderStatus;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { customer: true, items: true },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit || 50, 100),
        skip: offset || 0,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders: orders.map(order => ({
        id: order.id,
        status: order.status,
        amount: order.amount,
        amountDisplay: `₹${(order.amount / 100).toLocaleString("en-IN")}`,
        customerName: order.customer?.name,
        itemCount: order.items.length,
        createdAt: order.createdAt,
      })),
      pagination: {
        total,
        limit: limit || 50,
        offset: offset || 0,
        hasMore: (offset || 0) + (limit || 50) < total,
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch orders." } }, { status: 500 });
  }
}
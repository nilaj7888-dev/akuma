import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const orderQuerySchema = z.object({
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// GET /api/consumer/orders/tracking - get consumer's orders with tracking info
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const url = new URL(request.url);
    const parsed = orderQuerySchema.safeParse({
      limit: url.searchParams.get("limit") || "20",
      offset: url.searchParams.get("offset") || "0",
    });

    if (!parsed.success)
      return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid query params." } }, { status: 400 });

    const { limit, offset } = parsed.data;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { consumerId: session.userId },
        include: {
          items: { include: { product: true } },
          transaction: true,
          merchant: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit || 20, 50),
        skip: offset || 0,
      }),
      prisma.order.count({ where: { consumerId: session.userId } }),
    ]);

    // Calculate estimated delivery dates based on order status
    const statusTimeline: Record<string, number> = {
      CREATED: 1,
      PENDING: 1,
      PAID: 1,
      PROCESSING: 3,
      COMPLETED: 0,
    };

    return NextResponse.json({
      orders: orders.map(order => {
        const daysToDelivery = statusTimeline[order.status] || 0;
        const estimatedDelivery = daysToDelivery > 0
          ? new Date(order.createdAt.getTime() + daysToDelivery * 24 * 60 * 60 * 1000)
          : null;

        return {
          id: order.id,
          status: order.status,
          amount: order.amount,
          amountDisplay: `₹${(order.amount / 100).toLocaleString("en-IN")}`,
          merchantName: order.merchant?.name,
          itemCount: order.items.length,
          items: order.items.map(item => ({
            productId: item.productId,
            productName: item.product?.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          payment: order.transaction ? {
            status: order.transaction.status,
            verified: order.transaction.verified,
          } : null,
          timeline: {
            status: order.status,
            statusDisplay: getStatusDisplay(order.status),
            orderedAt: order.createdAt,
            estimatedDelivery,
            stages: getDeliveryStages(order.status, order.createdAt),
          },
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        };
      }),
      pagination: {
        total,
        limit: limit || 20,
        offset: offset || 0,
        hasMore: (offset || 0) + (limit || 20) < total,
      },
    });
  } catch (error) {
    console.error("Error fetching consumer orders:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch orders." } }, { status: 500 });
  }
}

function getStatusDisplay(status: string): string {
  const displayMap: Record<string, string> = {
    CREATED: "Order Created",
    PENDING: "Order Pending",
    PAID: "Payment Confirmed",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    FAILED: "Payment Failed",
    CANCELLED: "Cancelled",
  };
  return displayMap[status] || status;
}

function getDeliveryStages(status: string, createdAt: Date) {
  const stages = [
    { name: "Ordered", completed: true, date: createdAt },
    { name: "Confirmed", completed: ["PAID", "PROCESSING", "COMPLETED"].includes(status), date: null },
    { name: "Processing", completed: ["PROCESSING", "COMPLETED"].includes(status), date: null },
    { name: "Delivered", completed: status === "COMPLETED", date: null },
  ];
  return stages;
}
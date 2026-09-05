import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";
import type { OrderStatus } from "@prisma/client";

const bulkOperationSchema = z.object({
  action: z.enum(["UPDATE_STATUS", "MARK_PROCESSED", "MARK_COMPLETED"]),
  orderIds: z.array(z.string()).min(1),
  status: z.string().optional(),
  trackingNumber: z.string().optional(),
});

// POST /api/merchant/orders/bulk - perform bulk operations on orders
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const parsed = bulkOperationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid bulk operation data." } }, { status: 400 });

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

    // Verify all orders belong to merchant
    const orders = await prisma.order.findMany({
      where: {
        id: { in: parsed.data.orderIds },
        merchantId: user.merchantId,
      },
    });

    if (orders.length !== parsed.data.orderIds.length)
      return NextResponse.json({ error: { code: "AKUMA_INVALID_ORDERS", message: "Some orders not found or don't belong to merchant." } }, { status: 400 });

    let updatedCount = 0;
    const action = parsed.data.action;

    if (action === "UPDATE_STATUS" && parsed.data.status) {
      const result = await prisma.order.updateMany({
        where: { id: { in: parsed.data.orderIds } },
        data: { status: parsed.data.status as OrderStatus },
      });
      updatedCount = result.count;
    } else if (action === "MARK_PROCESSED") {
      const result = await prisma.order.updateMany({
        where: { id: { in: parsed.data.orderIds }, status: "PAID" as OrderStatus },
        data: { status: "PROCESSING" as OrderStatus },
      });
      updatedCount = result.count;
    } else if (action === "MARK_COMPLETED") {
      const result = await prisma.order.updateMany({
        where: { id: { in: parsed.data.orderIds }, status: "PROCESSING" as OrderStatus },
        data: { status: "COMPLETED" as OrderStatus },
      });
      updatedCount = result.count;
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        merchantId: user.merchantId,
        actorType: "USER",
        actorId: session.userId,
        action: "BULK_ORDER_OPERATION",
        resourceType: "Order",
        input: {
          action: parsed.data.action,
          orderCount: parsed.data.orderIds.length,
          status: parsed.data.status,
        },
      },
    });

    return NextResponse.json({
      message: `${updatedCount} orders updated`,
      count: updatedCount,
    });
  } catch (error) {
    console.error("Error performing bulk operation:", error);
    return NextResponse.json({ error: { code: "AKUMA_BULK_ERROR", message: "Bulk operation failed." } }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import type { OrderStatus, NotificationType } from "@prisma/client";

// PATCH /api/merchant/orders/[id]/fulfill - update order fulfillment status
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const resolvedParams = await params;
    const data = await request.json();

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { merchantId: true },
    });

    if (!user || !user.merchantId)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    // Verify order belongs to merchant
    const order = await prisma.order.findUnique({
      where: { id: resolvedParams.id },
      include: { customer: true, items: true },
    });

    if (!order)
      return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Order not found." } }, { status: 404 });

    if (order.merchantId !== user.merchantId)
      return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Cannot access this order." } }, { status: 403 });

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      CREATED: ["PENDING", "CANCELLED"],
      PENDING: ["PAID", "CANCELLED"],
      PAID: ["PROCESSING", "CANCELLED"],
      PROCESSING: ["COMPLETED"],
    };

    const newStatus = data.status;
    const validNextStatuses = validTransitions[order.status];

    if (!validNextStatuses || !validNextStatuses.includes(newStatus)) {
      return NextResponse.json({
        error: { code: "AKUMA_INVALID_STATUS", message: `Invalid status transition from ${order.status} to ${newStatus}. Valid: ${validNextStatuses?.join(", ")}` },
      }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id: resolvedParams.id },
      data: {
        status: newStatus as OrderStatus,
        updatedAt: new Date(),
      },
      include: { customer: true, items: true, transaction: true },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        merchantId: user.merchantId,
        actorType: "USER",
        actorId: session.userId,
        action: "ORDER_STATUS_UPDATE",
        resourceType: "Order",
        resourceId: order.id,
        input: { fromStatus: order.status, toStatus: newStatus },
      },
    });

    // Create notification for order status changes
    const notificationTypeMap: Record<string, string> = {
      PAID: "ORDER_CREATED",
      PROCESSING: "ORDER_CREATED",
      COMPLETED: "ORDER_DELIVERED",
    };

    if (notificationTypeMap[newStatus]) {
      const titleMap: Record<string, string> = {
        PAID: "New Order",
        PROCESSING: "Order Processing",
        COMPLETED: "Order Completed",
      };

      const messageMap: Record<string, string> = {
        PAID: `Order #${order.id.slice(-6)} created for ${order.amount / 100} ${order.currency}`,
        PROCESSING: `Order #${order.id.slice(-6)} is now being processed`,
        COMPLETED: `Order #${order.id.slice(-6)} has been completed`,
      };

      await prisma.notification.create({
        data: {
          merchantId: user.merchantId,
          type: notificationTypeMap[newStatus] as NotificationType,
          title: titleMap[newStatus],
          message: messageMap[newStatus],
          resourceType: "Order",
          resourceId: order.id,
          actionUrl: `/dashboard/orders/${order.id}`,
        },
      });
    }

    return NextResponse.json({
      order: {
        id: updated.id,
        status: updated.status,
        amount: updated.amount,
        customerName: updated.customer?.name,
        itemCount: updated.items.length,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating order fulfillment:", error);
    return NextResponse.json({ error: { code: "AKUMA_UPDATE_ERROR", message: "Failed to update order." } }, { status: 500 });
  }
}
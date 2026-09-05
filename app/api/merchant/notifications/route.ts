import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";
import { z } from "zod";
import type { Prisma, NotificationType } from "@prisma/client";

const notificationQuerySchema = z.object({
  unreadOnly: z.string().transform(v => v === "true").optional(),
  type: z.string().optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// GET /api/merchant/notifications - fetch merchant's notifications
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

    // Parse query params
    const url = new URL(request.url);
    const parsed = notificationQuerySchema.safeParse({
      unreadOnly: url.searchParams.get("unreadOnly"),
      type: url.searchParams.get("type"),
      limit: url.searchParams.get("limit") || "50",
      offset: url.searchParams.get("offset") || "0",
    });

    if (!parsed.success)
      return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid query params." } }, { status: 400 });

    const { unreadOnly, type, limit, offset } = parsed.data;

    // Build where clause
    const where: Prisma.NotificationWhereInput = { merchantId: merchant.id };
    if (unreadOnly) where.read = false;
    if (type) where.type = type as NotificationType;

    // Fetch notifications with pagination
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit || 50, 100), // Max 100
        skip: offset || 0,
      }),
      prisma.notification.count({ where }),
    ]);

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: { merchantId: merchant.id, read: false },
    });

    return NextResponse.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        resourceType: n.resourceType,
        resourceId: n.resourceId,
        read: n.read,
        readAt: n.readAt,
        actionUrl: n.actionUrl,
        metadata: n.metadata,
        createdAt: n.createdAt,
      })),
      pagination: {
        total,
        limit: limit || 50,
        offset: offset || 0,
        hasMore: (offset || 0) + (limit || 50) < total,
      },
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch notifications." } }, { status: 500 });
  }
}

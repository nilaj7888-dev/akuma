import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import type { NotificationType } from "@prisma/client";

// GET /api/merchant/notifications/stream - server-sent events for real-time notifications
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
    // Get merchant ID from authenticated user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { merchantId: true },
    });

    if (!user || !user.merchantId)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    // Return simple polling endpoint for now (SSE can be implemented later)
    // This returns the current unread notification count
    const unreadCount = await prisma.notification.count({
      where: { merchantId: user.merchantId, read: false },
    });

    // Also get recent critical notifications
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const criticalTypes: NotificationType[] = ["BUYER_INTEREST_NEW", "ORDER_CREATED", "PAYMENT_RECEIVED", "LOW_STOCK"];

    const recentCritical = await prisma.notification.findMany({
      where: {
        merchantId: user.merchantId,
        type: { in: criticalTypes },
        OR: [
          { read: false },
          { createdAt: { gte: twentyFourHoursAgo } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      unreadCount,
      recentCritical,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error streaming notifications:", error);
    return NextResponse.json({ error: { code: "AKUMA_STREAM_ERROR", message: "Failed to stream notifications." } }, { status: 500 });
  }
}

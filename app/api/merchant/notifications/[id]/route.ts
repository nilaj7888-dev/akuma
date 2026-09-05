import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

// PATCH /api/merchant/notifications/[id]/read - mark notification as read
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

    const merchant = await resolveMerchant(prisma, session);

    if (!merchant)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    const notification = await prisma.notification.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!notification)
      return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Notification not found." } }, { status: 404 });

    if (notification.merchantId !== merchant.id)
      return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Cannot access this notification." } }, { status: 403 });

    const updated = await prisma.notification.update({
      where: { id: resolvedParams.id },
      data: { read: true, readAt: new Date() },
    });

    return NextResponse.json({
      notification: {
        id: updated.id,
        type: updated.type,
        title: updated.title,
        message: updated.message,
        read: updated.read,
        readAt: updated.readAt,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json({ error: { code: "AKUMA_UPDATE_ERROR", message: "Failed to update notification." } }, { status: 500 });
  }
}

// DELETE /api/merchant/notifications/[id] - delete a notification
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const merchant = await resolveMerchant(prisma, session);

    if (!merchant)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    const notification = await prisma.notification.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!notification)
      return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Notification not found." } }, { status: 404 });

    if (notification.merchantId !== merchant.id)
      return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Cannot delete this notification." } }, { status: 403 });

    await prisma.notification.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json({ error: { code: "AKUMA_DELETE_ERROR", message: "Failed to delete notification." } }, { status: 500 });
  }
}
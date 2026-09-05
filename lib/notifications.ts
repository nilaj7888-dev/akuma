import { PrismaClient, type NotificationType, type Prisma } from "@prisma/client";

/**
 * Creates a notification for a merchant
 * Used throughout the app when significant events occur
 */
export async function createNotification(
  prisma: PrismaClient,
  merchantId: string,
  data: {
    type: "BUYER_INTEREST_NEW" | "BUYER_INTEREST_ACCEPTED" | "ORDER_CREATED" | "ORDER_SHIPPED" | "ORDER_DELIVERED" | "PAYMENT_RECEIVED" | "LOW_STOCK" | "REVIEW_POSTED" | "MESSAGE_RECEIVED";
    title: string;
    message: string;
    resourceType: string;
    resourceId: string;
    actionUrl?: string;
    metadata?: Prisma.InputJsonObject;
  }
) {
  try {
    const notification = await prisma.notification.create({
      data: {
        merchantId,
        type: data.type,
        title: data.title,
        message: data.message,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        actionUrl: data.actionUrl,
        metadata: data.metadata || {},
      },
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

/**
 * Mark all notifications of a specific type as read
 */
export async function markNotificationsAsRead(
  prisma: PrismaClient,
  merchantId: string,
  type?: NotificationType
) {
  try {
    const where: Prisma.NotificationWhereInput = { merchantId, read: false };
    if (type) where.type = type;

    const result = await prisma.notification.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    throw error;
  }
}

/**
 * Get unread notification count for a merchant
 */
export async function getUnreadNotificationCount(
  prisma: PrismaClient,
  merchantId: string
) {
  try {
    const count = await prisma.notification.count({
      where: {
        merchantId,
        read: false,
      },
    });

    return count;
  } catch (error) {
    console.error("Error getting unread count:", error);
    throw error;
  }
}

/**
 * Get recent critical notifications (unread or last 24 hours)
 */
export async function getCriticalNotifications(
  prisma: PrismaClient,
  merchantId: string,
  types: NotificationType[] = ["BUYER_INTEREST_NEW", "ORDER_CREATED", "PAYMENT_RECEIVED", "LOW_STOCK"]
) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const notifications = await prisma.notification.findMany({
      where: {
        merchantId,
        type: { in: types },
        OR: [
          { read: false },
          { createdAt: { gte: twentyFourHoursAgo } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return notifications;
  } catch (error) {
    console.error("Error getting critical notifications:", error);
    throw error;
  }
}

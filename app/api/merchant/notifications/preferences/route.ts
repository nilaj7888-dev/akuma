import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";
import { z } from "zod";
import type { NotificationType } from "@prisma/client";

const preferenceSchema = z.object({
  type: z.enum(["BUYER_INTEREST_NEW", "BUYER_INTEREST_ACCEPTED", "ORDER_CREATED", "ORDER_DELIVERED", "PAYMENT_RECEIVED", "LOW_STOCK", "REVIEW_POSTED", "MESSAGE_RECEIVED"]),
  enabled: z.boolean().default(true),
  push: z.boolean().default(false),
  email: z.boolean().default(false),
  sms: z.boolean().default(false),
  threshold: z.number().int().min(0).optional(),
});

// GET /api/merchant/notifications/preferences - get all notification preferences
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

    const preferences = await prisma.notificationPreference.findMany({
      where: { merchantId: merchant.id },
    });

    return NextResponse.json({
      preferences: preferences.map(p => ({
        type: p.type,
        enabled: p.enabled,
        push: p.push,
        email: p.email,
        sms: p.sms,
        threshold: p.threshold,
      })),
    });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch preferences." } }, { status: 500 });
  }
}

// PUT /api/merchant/notifications/preferences - update notification preference
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid preference data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    const preference = await prisma.notificationPreference.upsert({
      where: {
        merchantId_type: {
          merchantId: merchant.id,
          type: parsed.data.type as any,
        },
      },
      update: {
        enabled: parsed.data.enabled,
        push: parsed.data.push,
        email: parsed.data.email,
        sms: parsed.data.sms,
        threshold: parsed.data.threshold,
      },
      create: {
        merchantId: merchant.id,
        type: parsed.data.type as any,
        enabled: parsed.data.enabled,
        push: parsed.data.push,
        email: parsed.data.email,
        sms: parsed.data.sms,
        threshold: parsed.data.threshold,
      },
    });

    return NextResponse.json({
      preference: {
        type: preference.type,
        enabled: preference.enabled,
        push: preference.push,
        email: preference.email,
        sms: preference.sms,
        threshold: preference.threshold,
      },
    });
  } catch (error) {
    console.error("Error updating notification preference:", error);
    return NextResponse.json({ error: { code: "AKUMA_UPDATE_ERROR", message: "Failed to update preference." } }, { status: 500 });
  }
}
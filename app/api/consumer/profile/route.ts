import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const profileSchema = z.object({
  phone: z.string().optional(),
  orderContactConsent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer profile only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const profile = await prisma.consumerProfile.findUnique({ where: { userId: session.userId } });
  if (!profile) {
    // Create default profile on first access
    const created = await prisma.consumerProfile.create({
      data: { userId: session.userId },
    });
    return NextResponse.json(created);
  }
  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer profile only." } }, { status: 403 });

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid profile data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Check if profile exists
  const existing = await prisma.consumerProfile.findUnique({ where: { userId: session.userId } });

  // Upsert consumer profile - use proper JSON type for preferences
  const profile = existing
    ? await prisma.consumerProfile.update({
        where: { userId: session.userId },
        data: {
          phone: parsed.data.phone,
          orderContactConsent: parsed.data.orderContactConsent,
          marketingConsent: parsed.data.marketingConsent,
          preferences: parsed.data.preferences as Prisma.JsonObject || undefined,
        },
      })
    : await prisma.consumerProfile.create({
        data: {
          userId: session.userId,
          phone: parsed.data.phone,
          orderContactConsent: parsed.data.orderContactConsent || false,
          marketingConsent: parsed.data.marketingConsent || false,
          preferences: parsed.data.preferences as Prisma.JsonObject || undefined,
        },
      });

  return NextResponse.json(profile);
}
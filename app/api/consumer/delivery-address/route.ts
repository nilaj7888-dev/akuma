import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const addressSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(4),
  country: z.string().default("India"),
  isDefault: z.boolean().optional(),
  contactConsent: z.boolean().default(false),
});

// GET /api/consumer/delivery-address - get all delivery addresses for consumer
export async function GET() {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get or create consumer profile
  let profile = await prisma.consumerProfile.findUnique({
    where: { userId: session.userId },
  });

  if (!profile) {
    profile = await prisma.consumerProfile.create({
      data: { userId: session.userId },
    });
  }

  const addresses = await prisma.deliveryAddress.findMany({
    where: { profileId: profile.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    addresses: addresses.map((addr) => ({
      id: addr.id,
      name: addr.name,
      phone: addr.phone,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      isDefault: addr.isDefault,
      contactConsent: addr.contactConsent,
      createdAt: addr.createdAt,
    })),
  });
}

// POST /api/consumer/delivery-address - add new delivery address
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const parsed = addressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid address data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get or create consumer profile
  let profile = await prisma.consumerProfile.findUnique({
    where: { userId: session.userId },
  });

  if (!profile) {
    profile = await prisma.consumerProfile.create({
      data: { userId: session.userId },
    });
  }

  // If this is default, unset other defaults
  if (parsed.data.isDefault) {
    await prisma.deliveryAddress.updateMany({
      where: { profileId: profile.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const address = await prisma.deliveryAddress.create({
    data: {
      profileId: profile.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2,
      city: parsed.data.city,
      state: parsed.data.state,
      postalCode: parsed.data.postalCode,
      country: parsed.data.country,
      isDefault: parsed.data.isDefault || false,
      contactConsent: parsed.data.contactConsent,
    },
  });

  return NextResponse.json({
    id: address.id,
    message: "Delivery address added successfully",
    address: {
      name: address.name,
      city: address.city,
      state: address.state,
      contactConsent: address.contactConsent,
    },
  }, { status: 201 });
}

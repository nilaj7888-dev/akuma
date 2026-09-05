import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const updateAddressSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  isDefault: z.boolean().optional(),
  contactConsent: z.boolean().optional(),
});

// PATCH /api/consumer/delivery-address/[id] - update delivery address
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const parsed = updateAddressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid address data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Verify ownership
  const profile = await prisma.consumerProfile.findUnique({
    where: { userId: session.userId },
  });

  if (!profile) return NextResponse.json({ error: { code: "AKUMA_PROFILE_NOT_FOUND", message: "Profile not found." } }, { status: 404 });

  const address = await prisma.deliveryAddress.findUnique({
    where: { id: params.id },
  });

  if (!address || address.profileId !== profile.id) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Delivery address not found." } }, { status: 404 });
  }

  // If setting as default, unset others
  if (parsed.data.isDefault === true) {
    await prisma.deliveryAddress.updateMany({
      where: { profileId: profile.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.deliveryAddress.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({
    id: updated.id,
    message: "Address updated successfully",
  });
}

// DELETE /api/consumer/delivery-address/[id] - delete delivery address
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Verify ownership
  const profile = await prisma.consumerProfile.findUnique({
    where: { userId: session.userId },
  });

  if (!profile) return NextResponse.json({ error: { code: "AKUMA_PROFILE_NOT_FOUND", message: "Profile not found." } }, { status: 404 });

  const address = await prisma.deliveryAddress.findUnique({
    where: { id: params.id },
  });

  if (!address || address.profileId !== profile.id) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Delivery address not found." } }, { status: 404 });
  }

  await prisma.deliveryAddress.delete({
    where: { id: params.id },
  });

  return NextResponse.json({
    message: "Address deleted successfully",
  });
}

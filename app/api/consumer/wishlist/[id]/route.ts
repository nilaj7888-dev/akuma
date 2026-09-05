import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().optional(),
  note: z.string().optional(),
  alertPrice: z.number().optional(),
  alertActive: z.boolean().optional(),
});

// PATCH /api/consumer/wishlist/[id] - update wishlist item
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid update data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const resolvedParams = await params;
    const wishlistItem = await prisma.wishlist.findUnique({
      where: { id: resolvedParams.id },
    });

    if (!wishlistItem || wishlistItem.userId !== session.userId)
      return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Wishlist item not found." } }, { status: 404 });

    const updated = await prisma.wishlist.update({
      where: { id: resolvedParams.id },
      data: {
        name: parsed.data.name ?? wishlistItem.name,
        note: parsed.data.note ?? wishlistItem.note,
        alertPrice: parsed.data.alertPrice ?? wishlistItem.alertPrice,
        alertActive: parsed.data.alertActive ?? wishlistItem.alertActive,
      },
    });

    return NextResponse.json({ wishlistItem: updated });
  } catch (error) {
    console.error("Error updating wishlist item:", error);
    return NextResponse.json({ error: { code: "AKUMA_UPDATE_ERROR", message: "Failed to update wishlist item." } }, { status: 500 });
  }
}
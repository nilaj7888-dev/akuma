import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

// GET /api/merchant/buyer-interests - get merchant's buyer interests with notifications
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get merchant ID from session
  const merchant = await resolveMerchant(prisma, session);

  if (!merchant) return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const pinnedOnly = searchParams.get("pinned") === "true";
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { merchantId: merchant.id };
  if (pinnedOnly) where.notificationPinned = true;
  if (status) where.status = status;

  const interests = await prisma.buyerInterest.findMany({
    where,
    include: {
      user: {
        select: { email: true, name: true },
      },
      product: {
        select: { name: true, price: true },
      },
    },
    orderBy: [{ notificationPinned: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    interests: interests.map((interest) => ({
      id: interest.id,
      buyerId: interest.userId,
      buyerEmail: interest.user.email,
      buyerName: interest.user.name,
      productName: interest.product.name,
      productPricePaise: interest.product.price,
      quantity: interest.quantity,
      preferredPricePaise: interest.preferredPrice,
      requirements: interest.requirements,
      status: interest.status,
      notificationPinned: interest.notificationPinned,
      merchantResponse: interest.merchantResponse,
      merchantCounterPricePaise: interest.merchantCounterPrice,
      merchantSeenAt: interest.merchantSeenAt,
      expiresAt: interest.expiresAt,
      createdAt: interest.createdAt,
      updatedAt: interest.updatedAt,
    })),
  });
}

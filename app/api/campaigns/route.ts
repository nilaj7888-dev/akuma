import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant) return NextResponse.json([]);

    const campaigns = await prisma.campaign.findMany({
      where: { merchantId: merchant.id },
      orderBy: { id: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Failed to fetch campaigns:", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    const body = await request.json();
    const { name, type, audience, budget, discount, productIds, startDate, endDate } = body;

    // Check policy
    const policy = await prisma.policy.findUnique({
      where: { merchantId: merchant.id },
    });

    if (policy && discount > policy.maxDiscountPercent) {
      return NextResponse.json({
        error: `Discount exceeds policy maximum of ${policy.maxDiscountPercent}%`
      }, { status: 400 });
    }

    const campaign = await prisma.campaign.create({
      data: {
        merchantId: merchant.id,
        name,
        type,
        audience,
        budget,
        discount,
        status: "DRAFT",
        // No forecasting model exists yet for a brand-new campaign — starting at
        // 0 and letting real performance (actualRevenue) fill in is honest;
        // a fabricated multiplier is not.
        expectedRevenue: 0,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        actorType: "USER",
        action: "CAMPAIGN_CREATED",
        resourceType: "Campaign",
        resourceId: campaign.id,
        reason: `Campaign "${name}" created with ${discount}% discount`,
      },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Failed to create campaign:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}

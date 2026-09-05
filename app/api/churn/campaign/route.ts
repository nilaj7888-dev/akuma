import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createWinBackCampaign } from "@/lib/churn";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const body = await request.json();
    const { customerIds, campaignType, discountPercent } = body as {
      customerIds: string[];
      campaignType: "REMINDER" | "DISCOUNT" | "BUNDLE" | "PRODUCT_REC";
      discountPercent?: number;
    };

    if (!customerIds || customerIds.length === 0) {
      return NextResponse.json({ error: "No customers selected" }, { status: 400 });
    }

    // Get merchant
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    // Create campaign
    const result = await createWinBackCampaign({
      merchantId: merchant.id,
      customerIds,
      campaignType,
      discountPercent,
    });

    if (!result) {
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 400 });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        actorType: "USER",
        actorId: session.username,
        action: "CREATE_CAMPAIGN",
        resourceType: "Campaign",
        resourceId: result.id,
        reason: `Created ${campaignType} win-back campaign for ${customerIds.length} customers`,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to create campaign:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

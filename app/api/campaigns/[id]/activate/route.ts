import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    // Get campaign and verify ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id, merchantId: merchant.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft campaigns can be activated" }, { status: 400 });
    }

    // Activate campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: "ACTIVE",
        startedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        actorType: "USER",
        action: "CAMPAIGN_ACTIVATED",
        resourceType: "Campaign",
        resourceId: campaign.id,
        reason: `Campaign "${campaign.name}" activated`,
      },
    });

    return NextResponse.json(updatedCampaign);
  } catch (error) {
    console.error("Failed to activate campaign:", error);
    return NextResponse.json({ error: "Failed to activate campaign" }, { status: 500 });
  }
}

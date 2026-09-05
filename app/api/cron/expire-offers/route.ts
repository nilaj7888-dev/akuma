import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

// POST /api/cron/expire-offers - Mark expired offers as expired
// This would typically be called by a cron job every hour
export async function POST(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const now = new Date();

    // Expire buyer interests past their expiration date
    const expiredInterests = await prisma.buyerInterest.updateMany({
      where: {
        status: "OPEN",
        expiresAt: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });

    // Expire old pending negotiations (7+ days without response)
    const expiredNegotiations = await prisma.negotiation.updateMany({
      where: {
        status: "CUSTOMER_OFFER",
        createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
      data: {
        status: "EXPIRED",
      },
    });

    // Expire old proposed opportunities (30+ days without action)
    const expiredOpportunities = await prisma.opportunity.updateMany({
      where: {
        status: "PROPOSED",
        createdAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      data: {
        status: "REJECTED",
      },
    });

    return NextResponse.json({
      success: true,
      expired: {
        buyerInterests: expiredInterests.count,
        negotiations: expiredNegotiations.count,
        opportunities: expiredOpportunities.count,
      },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Error expiring offers:", error);
    return NextResponse.json({ error: "Failed to expire offers" }, { status: 500 });
  }
}

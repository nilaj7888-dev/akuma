import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const negotiationResponseSchema = z.object({
  decision: z.enum(["APPROVE", "COUNTER", "REJECT"]),
  counterPrice: z.number().int().positive().optional(),
  reason: z.string().optional(),
});

// PATCH /api/merchant/negotiation/[id] - approve/counter/reject negotiation
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const parsed = negotiationResponseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid response." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const { id } = await params;

  // Get negotiation and verify it belongs to this merchant
  const negotiation = await prisma.negotiation.findUnique({
    where: { id },
  });

  if (!negotiation) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Negotiation not found." } }, { status: 404 });

  const merchant = await prisma.merchant.findUnique({
    where: { email: "demo@nova-electronics.test" },
  });

  if (!merchant || negotiation.merchantId !== merchant.id) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "This negotiation is not for your merchant." } }, { status: 403 });
  }

  // Process decision
  let newStatus: "ACCEPTED" | "REJECTED" | "MERCHANT_COUNTER" = "REJECTED";
  let approvedPrice: number | null = null;

  if (parsed.data.decision === "APPROVE") {
    if (!negotiation.requestedPrice) {
      return NextResponse.json({ error: { code: "AKUMA_INVALID", message: "Cannot approve without a requested price." } }, { status: 400 });
    }
    newStatus = "ACCEPTED";
    approvedPrice = negotiation.requestedPrice;
  } else if (parsed.data.decision === "COUNTER") {
    if (!parsed.data.counterPrice) {
      return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Counter price required." } }, { status: 400 });
    }
    newStatus = "MERCHANT_COUNTER";
    approvedPrice = parsed.data.counterPrice;
  } else if (parsed.data.decision === "REJECT") {
    newStatus = "REJECTED";
  }

  const updated = await prisma.negotiation.update({
    where: { id },
    data: {
      status: newStatus,
      approvedPrice,
      approverUserId: session.userId,
    },
  });

  // Audit the decision
  await prisma.auditLog.create({
    data: {
      merchantId: merchant.id,
      actorType: "USER",
      action: `NEGOTIATION_${parsed.data.decision}`,
      resourceType: "NEGOTIATION",
      resourceId: negotiation.id,
      reason: parsed.data.reason,
      output: {
        decision: parsed.data.decision,
        counterPrice: parsed.data.counterPrice,
        originalPrice: negotiation.originalPrice,
        requestedPrice: negotiation.requestedPrice,
      },
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    approvedPrice: updated.approvedPrice,
    approvedPriceDisplay: updated.approvedPrice ? `₹${(updated.approvedPrice / 100).toLocaleString("en-IN")}` : null,
  });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// GET /api/consumer/negotiation/[id] - get negotiation status
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const { id } = await params;

  const negotiation = await prisma.negotiation.findUnique({
    where: { id },
  });

  if (!negotiation) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Negotiation not found." } }, { status: 404 });

  // Verify consumer owns this negotiation
  if (negotiation.userId !== session.userId) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "You do not have access to this negotiation." } }, { status: 403 });
  }

  // Fetch product details
  const product = await prisma.product.findUnique({
    where: { id: negotiation.productId },
    select: { name: true, merchant: { select: { name: true } } },
  });

  return NextResponse.json({
    id: negotiation.id,
    productName: product?.name,
    merchantName: product?.merchant.name,
    quantity: negotiation.quantity,
    originalPricePaise: negotiation.originalPrice,
    originalPriceDisplay: `₹${(negotiation.originalPrice / 100).toLocaleString("en-IN")}`,
    requestedPricePaise: negotiation.requestedPrice,
    requestedPriceDisplay: negotiation.requestedPrice ? `₹${(negotiation.requestedPrice / 100).toLocaleString("en-IN")}` : null,
    approvedPricePaise: negotiation.approvedPrice,
    approvedPriceDisplay: negotiation.approvedPrice ? `₹${(negotiation.approvedPrice / 100).toLocaleString("en-IN")}` : null,
    status: negotiation.status,
    createdAt: negotiation.createdAt,
    updatedAt: negotiation.updatedAt,
  });
}

// PATCH /api/consumer/negotiation/[id] - accept/reject merchant counter
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.decision || !["ACCEPT", "REJECT"].includes(body.decision)) {
    return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Decision must be ACCEPT or REJECT." } }, { status: 400 });
  }

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const { id } = await params;

  const negotiation = await prisma.negotiation.findUnique({
    where: { id },
  });

  if (!negotiation) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Negotiation not found." } }, { status: 404 });

  // Verify consumer owns this negotiation
  if (negotiation.userId !== session.userId) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "You do not have access to this negotiation." } }, { status: 403 });
  }

  // Only allow acceptance/rejection if there's a merchant counter
  if (negotiation.status !== "MERCHANT_COUNTER") {
    return NextResponse.json({ error: { code: "AKUMA_INVALID", message: "This negotiation is not awaiting your response." } }, { status: 400 });
  }

  const newStatus = body.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";

  const updated = await prisma.negotiation.update({
    where: { id },
    data: { status: newStatus },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    approvedPrice: updated.approvedPrice,
  });
}

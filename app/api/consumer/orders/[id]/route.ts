import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer orders only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: true },
      },
      transaction: true,
      merchant: true,
    },
  });

  if (!order) return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Order not found." } }, { status: 404 });

  // Verify consumer owns this order
  if (order.consumerId !== session.userId) {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "You do not have access to this order." } }, { status: 403 });
  }

  return NextResponse.json({
    id: order.id,
    merchantName: order.merchant.name,
    merchantEmail: order.merchant.email,
    status: order.status,
    amount: order.amount,
    amountDisplay: `₹${(order.amount / 100).toLocaleString("en-IN")}`,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitPriceDisplay: `₹${(item.unitPrice / 100).toLocaleString("en-IN")}`,
      total: item.total,
      totalDisplay: `₹${(item.total / 100).toLocaleString("en-IN")}`,
    })),
    transaction: order.transaction ? {
      id: order.transaction.id,
      razorpayPaymentId: order.transaction.razorpayPaymentId,
      status: order.transaction.status,
      verified: order.transaction.verified,
      failureReason: order.transaction.failureReason,
    } : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  });
}

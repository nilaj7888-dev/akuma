import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";
import { haversineDistanceKm, estimateDeliveryCostPaise } from "@/lib/geo";

// GET /api/merchant/orders/[id] - get order details
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const resolvedParams = await params;
    const resolvedMerchant = await resolveMerchant(prisma, session);

    if (!resolvedMerchant)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    const merchant = await prisma.merchant.findUnique({
      where: { id: resolvedMerchant.id },
      select: { id: true, latitude: true, longitude: true },
    });

    const order = await prisma.order.findUnique({
      where: { id: resolvedParams.id },
      include: {
        customer: true,
        items: { include: { product: true } },
        transaction: true,
        deliveryAddress: true,
      },
    });

    if (!order)
      return NextResponse.json({ error: { code: "AKUMA_NOT_FOUND", message: "Order not found." } }, { status: 404 });

    if (order.merchantId !== merchant?.id)
      return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Cannot access this order." } }, { status: 403 });

    // Only compute an estimate when both the merchant and the delivery address
    // have real coordinates — never fabricate a distance/cost figure.
    let delivery: { distanceKm: number; estimatedCostPaise: number; estimatedCostDisplay: string } | null = null;
    if (
      merchant?.latitude != null && merchant?.longitude != null &&
      order.deliveryAddress?.latitude != null && order.deliveryAddress?.longitude != null
    ) {
      const distanceKm = haversineDistanceKm(merchant.latitude, merchant.longitude, order.deliveryAddress.latitude, order.deliveryAddress.longitude);
      const estimatedCostPaise = estimateDeliveryCostPaise(distanceKm);
      delivery = {
        distanceKm: Math.round(distanceKm * 10) / 10,
        estimatedCostPaise,
        estimatedCostDisplay: `₹${(estimatedCostPaise / 100).toLocaleString("en-IN")}`,
      };
    }

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        amount: order.amount,
        amountDisplay: `₹${(order.amount / 100).toLocaleString("en-IN")}`,
        currency: order.currency,
        source: order.source,
        createdAt: order.createdAt,
        customer: order.customer ? {
          id: order.customer.id,
          name: order.customer.name,
          email: order.customer.email,
          phone: order.customer.phone,
          segment: order.customer.segment,
        } : null,
        deliveryAddress: order.deliveryAddress ? {
          name: order.deliveryAddress.name,
          phone: order.deliveryAddress.phone,
          addressLine1: order.deliveryAddress.addressLine1,
          addressLine2: order.deliveryAddress.addressLine2,
          city: order.deliveryAddress.city,
          state: order.deliveryAddress.state,
          postalCode: order.deliveryAddress.postalCode,
        } : null,
        delivery,
        items: order.items.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.product?.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitPriceDisplay: `₹${(item.unitPrice / 100).toLocaleString("en-IN")}`,
          total: item.total,
        })),
        transaction: order.transaction ? {
          id: order.transaction.id,
          razorpayPaymentId: order.transaction.razorpayPaymentId,
          status: order.transaction.status,
          verified: order.transaction.verified,
          failureReason: order.transaction.failureReason,
        } : null,
      },
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to fetch order." } }, { status: 500 });
  }
}
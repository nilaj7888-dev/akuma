import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";
import Razorpay from "razorpay";

const checkoutSchema = z.object({
  orderContactConsent: z.boolean(),
  marketingConsent: z.boolean().optional(),
  deliveryAddressId: z.string().optional(),
});

// POST /api/consumer/checkout - create order and Razorpay payment
export async function POST(request: Request) {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer checkout only." } }, { status: 403 });

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid consent data." } }, { status: 400 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    // Get consumer's current shopping session and cart
    const shoppingSession = await prisma.shoppingSession.findFirst({
      where: { userId: session.userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    if (!shoppingSession || shoppingSession.items.length === 0) {
      return NextResponse.json({ error: { code: "AKUMA_EMPTY_CART", message: "Cart is empty." } }, { status: 400 });
    }

    // Fetch product details and validate
    const productIds = shoppingSession.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { merchant: true },
    });

    if (products.length === 0) {
      return NextResponse.json({ error: { code: "AKUMA_INVALID_PRODUCTS", message: "Products not found." } }, { status: 400 });
    }

    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    // Server-side calculation: validate stock and calculate total
    let totalAmount = 0;
    const orderItems: Array<{ productId: string; quantity: number; unitPrice: number; merchantId: string }> = [];

    for (const cartItem of shoppingSession.items) {
      const product = productMap[cartItem.productId];
      if (!product) {
        return NextResponse.json({ error: { code: "AKUMA_PRODUCT_NOT_FOUND", message: `Product ${cartItem.productId} not found.` } }, { status: 400 });
      }
      if (!product.active || product.stock < cartItem.quantity) {
        return NextResponse.json({ error: { code: "AKUMA_INSUFFICIENT_STOCK", message: `${product.name} has insufficient stock.` } }, { status: 400 });
      }
      totalAmount += product.price * cartItem.quantity;
      orderItems.push({
        productId: product.id,
        quantity: cartItem.quantity,
        unitPrice: product.price,
        merchantId: product.merchantId,
      });
    }

    if (totalAmount <= 0) {
      return NextResponse.json({ error: { code: "AKUMA_INVALID_AMOUNT", message: "Invalid order total." } }, { status: 400 });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount, // in paise
      currency: "INR",
      receipt: `order_${session.userId}_${Date.now()}`,
    });

    // Save consumer profile consent
    const consumerProfile = await prisma.consumerProfile.upsert({
      where: { userId: session.userId },
      update: {
        orderContactConsent: parsed.data.orderContactConsent,
        marketingConsent: parsed.data.marketingConsent ?? false,
      },
      create: {
        userId: session.userId,
        orderContactConsent: parsed.data.orderContactConsent,
        marketingConsent: parsed.data.marketingConsent ?? false,
      },
    });

    // Validate the delivery address belongs to this consumer before attaching it
    let deliveryAddressId: string | undefined;
    if (parsed.data.deliveryAddressId) {
      const address = await prisma.deliveryAddress.findFirst({
        where: { id: parsed.data.deliveryAddressId, profileId: consumerProfile.id },
      });
      if (!address) {
        return NextResponse.json({ error: { code: "AKUMA_INVALID_ADDRESS", message: "Delivery address not found." } }, { status: 400 });
      }
      deliveryAddressId = address.id;
    }

    // Create internal order record
    const internalOrder = await prisma.order.create({
      data: {
        merchantId: products[0].merchantId, // First product's merchant (in real system, handle multi-merchant)
        consumerId: session.userId,
        razorpayOrderId: razorpayOrder.id,
        amount: totalAmount,
        status: "PAYMENT_PENDING",
        source: "CONSUMER_APP",
        deliveryAddressId,
        items: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    // Create audit log for order creation
    await prisma.auditLog.create({
      data: {
        merchantId: products[0].merchantId,
        actorType: "USER",
        action: "ORDER_CREATED",
        resourceType: "Order",
        resourceId: internalOrder.id,
        input: {
          consumerId: session.userId,
          products: orderItems.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
          totalAmount,
          razorpayOrderId: razorpayOrder.id,
        },
        output: {
          orderId: internalOrder.id,
          status: "PAYMENT_PENDING",
        },
      },
    });

    return NextResponse.json({
      orderId: internalOrder.id,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      amountDisplay: `₹${(totalAmount / 100).toLocaleString("en-IN")}`,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      status: "PAYMENT_PENDING",
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: { code: "AKUMA_CHECKOUT_ERROR", message: "Checkout failed." } }, { status: 500 });
  }
}

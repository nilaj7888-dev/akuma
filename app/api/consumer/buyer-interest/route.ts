import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// Create a buyer interest when a consumer expresses interest
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  const body = await request.json() as {
    productId: string;
    quantity: number;
    preferredPrice?: number;
    merchantId: string;
  };

  // Get user
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get product
  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    include: { merchant: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Create buyer interest
  const interest = await prisma.buyerInterest.create({
    data: {
      userId: user.id,
      merchantId: body.merchantId,
      productId: body.productId,
      quantity: body.quantity,
      preferredPrice: body.preferredPrice,
      status: "OPEN",
      merchantSeen: false,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
      requirements: {
        productName: product.name,
        category: product.category,
      } as unknown as undefined,
    },
  });

  // Create merchant notification
  await prisma.notification.create({
    data: {
      merchantId: body.merchantId,
      type: "BUYER_INTEREST_NEW",
      title: `New interest: ${product.name}`,
      message: `${user.name} is interested in ${body.quantity} unit(s) of ${product.name}`,
      resourceType: "BUYER_INTEREST",
      resourceId: interest.id,
      actionUrl: `/dashboard/opportunities?interestId=${interest.id}`,
      metadata: {
        interestId: interest.id,
        buyerName: user.name,
        productName: product.name,
        quantity: body.quantity,
        preferredPrice: body.preferredPrice,
      },
    },
  });

  // Send merchant email if available
  if (product.merchant.email) {
    try {
      const { sendEmail } = await import("@/lib/email");
      const budgetDisplay = body.preferredPrice ? `₹${(body.preferredPrice / 100).toLocaleString("en-IN")}` : "negotiable";
      await sendEmail(
        product.merchant.email,
        `New Buyer Interest - ${product.name}`,
        `<div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #e9a85d;">New Buyer Interest!</h2>
          <p><strong>Product:</strong> ${product.name}</p>
          <p><strong>Quantity:</strong> ${body.quantity || 1}</p>
          <p><strong>Budget:</strong> ${budgetDisplay}</p>
          <p style="margin-top: 20px;"><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/opportunities?interestId=${interest.id}" style="background: #e9a85d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Interest</a></p>
        </div>`
      );
    } catch (error) {
      console.error("Failed to send email:", error);
    }
  }
      // Create audit log
  await prisma.auditLog.create({
    data: {
      merchantId: body.merchantId,
      actorType: "USER",
      action: "BUYER_INTEREST_CREATED",
      resourceType: "BUYER_INTEREST",
      resourceId: interest.id,
      reason: "Consumer expressed product interest",
      input: { buyerId: user.id, buyerName: user.name, productId: body.productId, productName: product.name, quantity: body.quantity } as unknown as undefined,
    },
  });

  return NextResponse.json(interest, { status: 201 });
}

// Get buyer interests for consumer
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  const interests = await prisma.buyerInterest.findMany({
    where: { userId: session.userId },
    include: { product: true, merchant: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ interests });
}

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  const { offerId, merchantId, buyerName, productName, quantity, budget, location } = await request.json() as {
    offerId?: string;
    merchantId?: string;
    buyerName?: string;
    productName?: string;
    quantity?: number;
    budget?: number;
    location?: string;
  };

  if (!offerId || !merchantId) {
    return NextResponse.json({ error: "Offer and merchant ID required" }, { status: 400 });
  }

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  // Get merchant email
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId }
  });
  if (!merchant || !merchant.email) {
    return NextResponse.json({ error: "Merchant email not found" }, { status: 404 });
  }

  // Build email
  const budgetDisplay = budget ? `₹${(budget / 100).toLocaleString("en-IN")}` : "negotiable";
  const subject = `New Buyer Interest - ${productName || "Your Product"}`;
  const message = `${buyerName || "A buyer"} is interested in ${productName || "your product"}. Qty ${quantity || 1}, Budget ${budgetDisplay}${location ? `, ${location}` : ""}. Review: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/merchant/offers/${offerId}`;

  const result = await sendEmail(
    merchant.email,
    subject,
    `<div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #e9a85d;">New Buyer Interest!</h2>
      <p><strong>Product:</strong> ${productName || "Your product"}</p>
      <p><strong>Buyer:</strong> ${buyerName || "A buyer"}</p>
      <p><strong>Quantity:</strong> ${quantity || 1}</p>
      <p><strong>Budget:</strong> ${budgetDisplay}</p>
      ${location ? `<p><strong>Location:</strong> ${location}</p>` : ""}
      <p style="margin-top: 20px;"><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/merchant/offers/${offerId}" style="background: #e9a85d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Offer</a></p>
    </div>`
  );

  if (!result.success) {
    console.error("Email failed:", result.error);
  }

  // Create internal notification
  await prisma.notification.create({
    data: {
      merchantId,
      type: "BUYER_INTEREST_NEW",
      title: `New buyer interested in ${productName || "product"}`,
      message: `${buyerName || "Buyer"} wants ${quantity || 1} unit(s) at ${budgetDisplay}`,
      resourceType: "OFFER",
      resourceId: offerId,
      actionUrl: `/merchant/offers/${offerId}`,
    },
  });

  return NextResponse.json({ success: true, emailSent: result.success });
}

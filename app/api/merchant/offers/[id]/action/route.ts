import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolveMerchant } from "@/lib/resolve-merchant";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.accountType !== "MERCHANT") {
    return NextResponse.json({ error: "Merchant authentication required" }, { status: 401 });
  }

  const { offerId, action, counterPrice, reason } = await request.json() as {
    offerId?: string;
    action?: "ACCEPT" | "REJECT" | "COUNTER";
    counterPrice?: number;
    reason?: string;
  };

  if (!offerId || !action) {
    return NextResponse.json({ error: "Offer ID and action required" }, { status: 400 });
  }

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  // Verify merchant ownership
  const merchant = await resolveMerchant(prisma, session);

  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 403 });
  }

  // Get negotiation/offer
  const negotiation = await prisma.negotiation.findUnique({
    where: { id: offerId },
    include: { user: true, product: true },
  });

  if (!negotiation) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (negotiation.merchantId !== merchant.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Prevent duplicate actions
  if (negotiation.status === "ACCEPTED" || negotiation.status === "REJECTED") {
    return NextResponse.json({ error: "Offer already processed" }, { status: 400 });
  }

  let updatedNegotiation;
  let emailSubject = "";
  let emailMessage = "";

  if (action === "ACCEPT") {
    updatedNegotiation = await prisma.negotiation.update({
      where: { id: offerId },
      data: {
        status: "ACCEPTED",
        approvedPrice: negotiation.requestedPrice || negotiation.originalPrice,
      },
    });

    emailSubject = `Offer Accepted - ${negotiation.product.name}`;
    emailMessage = `Your offer for ${negotiation.product.name} was accepted! Proceed to checkout: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/shop/checkout?negotiation=${offerId}`;

    // Create audit log
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        actorType: "USER",
        action: "OFFER_ACCEPTED",
        resourceType: "NEGOTIATION",
        resourceId: offerId,
        reason: "Merchant accepted buyer offer",
        input: { negotiationId: offerId, acceptedPrice: updatedNegotiation.approvedPrice } as any,
      },
    });
  } else if (action === "REJECT") {
    updatedNegotiation = await prisma.negotiation.update({
      where: { id: offerId },
      data: { status: "REJECTED" },
    });

    emailSubject = `Offer Declined - ${negotiation.product.name}`;
    emailMessage = `Your offer for ${negotiation.product.name} was declined${reason ? `: ${reason}` : ""}.`;

    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        actorType: "USER",
        action: "OFFER_REJECTED",
        resourceType: "NEGOTIATION",
        resourceId: offerId,
        reason: reason || "Merchant rejected offer",
        input: { negotiationId: offerId } as any,
      },
    });
  } else if (action === "COUNTER") {
    if (!counterPrice || counterPrice <= 0) {
      return NextResponse.json({ error: "Valid counter price required" }, { status: 400 });
    }

    updatedNegotiation = await prisma.negotiation.update({
      where: { id: offerId },
      data: {
        status: "MERCHANT_COUNTER",
        approvedPrice: counterPrice,
      },
    });

    emailSubject = `Counter-Offer - ${negotiation.product.name}`;
    emailMessage = `Counter-offer for ${negotiation.product.name}: ₹${(counterPrice / 100).toLocaleString("en-IN")} per unit. Review: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/shop/offers/${offerId}`;

    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        actorType: "USER",
        action: "COUNTER_OFFERED",
        resourceType: "NEGOTIATION",
        resourceId: offerId,
        reason: "Merchant counter-offered",
        input: { negotiationId: offerId, counterPrice } as any,
      },
    });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Send buyer email if they have an email
  if (negotiation.user.email) {
    await sendEmail(
      negotiation.user.email,
      emailSubject,
      `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>${emailSubject}</h2><p>${emailMessage}</p></div>`
    );
  }

  // Create buyer notification
  await prisma.notification.create({
    data: {
      merchantId: merchant.id,
      type: action === "ACCEPT" ? "BUYER_INTEREST_ACCEPTED" : "MESSAGE_RECEIVED",
      title: `Offer ${action.toLowerCase()}ed`,
      message: emailMessage,
      resourceType: "NEGOTIATION",
      resourceId: offerId,
    },
  });

  return NextResponse.json({ success: true, negotiation: updatedNegotiation });
}

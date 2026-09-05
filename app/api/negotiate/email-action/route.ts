import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import jwt from "jsonwebtoken";

interface TokenPayload {
  negotiationId: string;
  action: "ACCEPT" | "REJECT";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: { code: "AKUMA_MISSING_TOKEN", message: "Token is required." } },
        { status: 400 }
      );
    }

    // Verify and decode JWT token
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    } catch (error) {
      // Token expired, invalid, or verification failed
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/negotiation/status?state=expired`
      );
    }

    const { negotiationId, action } = decoded;

    // Get Prisma client
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } },
        { status: 503 }
      );
    }

    // Fetch negotiation with relations
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      include: {
        product: true,
        merchant: true,
        user: true,
      },
    });

    if (!negotiation) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/negotiation/status?state=expired`
      );
    }

    // Check if negotiation is still open (not already processed)
    if (!["OPEN", "CUSTOMER_OFFER", "MERCHANT_APPROVAL_REQUIRED"].includes(negotiation.status)) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/negotiation/status?state=already_processed`
      );
    }

    // Determine new status and audit action based on merchant decision
    const newStatus = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";
    const auditAction = action === "ACCEPT" ? "OFFER_ACCEPTED" : "OFFER_REJECTED";
    const priceAtAction = negotiation.requestedPrice || negotiation.originalPrice;

    // Atomic transaction: update negotiation + create audit log
    await prisma.$transaction(async (tx) => {
      // Update negotiation status
      await tx.negotiation.update({
        where: { id: negotiationId },
        data: {
          status: newStatus,
          approvedPrice: action === "ACCEPT" ? priceAtAction : null,
          updatedAt: new Date(),
        },
      });

      // Create audit log entry
      await tx.negotiationAudit.create({
        data: {
          negotiationId,
          action: auditAction,
          actor: "MERCHANT",
          price: priceAtAction,
          metadata: {
            email: negotiation.merchant.email,
            productName: negotiation.product.name,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Create buyer notification for the outcome
      const notificationTitle =
        action === "ACCEPT"
          ? `Offer Accepted for ${negotiation.product.name}`
          : `Offer Rejected for ${negotiation.product.name}`;

      const notificationMessage =
        action === "ACCEPT"
          ? `Your offer has been accepted! Proceed to checkout at the agreed price.`
          : `Your offer has been rejected. Feel free to make another offer or explore other products.`;

      // Note: We're creating a notification for the merchant (for audit purposes)
      // In production, you'd also create a notification for the buyer via a separate notification system
      await tx.notification.create({
        data: {
          merchantId: negotiation.merchantId,
          type: "BUYER_INTEREST_ACCEPTED",
          title: `Email Action: ${notificationTitle}`,
          message: `Merchant decided via email: ${notificationMessage}`,
          resourceType: "NEGOTIATION",
          resourceId: negotiationId,
          actionUrl: `/merchant/negotiations/${negotiationId}`,
          metadata: {
            action,
            buyerEmail: negotiation.user.email,
            productName: negotiation.product.name,
            priceAtAction,
          },
        },
      });
    });

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/negotiation/status?state=${action === "ACCEPT" ? "accepted" : "rejected"}`
    );
  } catch (error) {
    console.error("Email action handler error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/negotiation/status?state=error`
    );
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import type { NegotiationStatus, Prisma } from "@prisma/client";

interface NegotiationMessage {
  role: "CUSTOMER" | "MERCHANT" | "AI" | "ACCEPTANCE";
  content: string;
  timestamp: string;
  acceptedBy?: "CUSTOMER" | "MERCHANT";
  acceptedPrice?: number;
  suggestedPrice?: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !session.userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in required." } },
      { status: 401 }
    );
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { error: { code: "DATABASE_REQUIRED", message: "Database required." } },
      { status: 503 }
    );
  }

  try {
    const { suggestedPrice, role } = (await request.json()) as {
      suggestedPrice?: number;
      role?: "CUSTOMER" | "MERCHANT";
    };

    if (!suggestedPrice || !role) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid request." } },
        { status: 400 }
      );
    }

    const negotiation = await prisma.negotiation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        merchantId: true,
        messages: true,
        status: true,
      },
    });

    if (!negotiation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Negotiation not found." } },
        { status: 404 }
      );
    }

    // Verify user is participant
    const isCustomer = negotiation.userId === session.userId;
    const isMerchant =
      negotiation.merchantId === session.userId ||
      negotiation.merchantId === session.username;

    if (!isCustomer && !isMerchant) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied." } },
        { status: 403 }
      );
    }

    // Get messages array
    const messages: NegotiationMessage[] = Array.isArray(negotiation.messages)
      ? (negotiation.messages as unknown as NegotiationMessage[])
      : [];

    // Check if other party already accepted
    const otherPartyAccepted = messages.some(
      (m: NegotiationMessage) =>
        m.role === "ACCEPTANCE" &&
        m.acceptedBy ===
          (role === "CUSTOMER" ? "MERCHANT" : "CUSTOMER") &&
        m.acceptedPrice === suggestedPrice
    );

    // Add acceptance message
    const acceptanceMessage: NegotiationMessage = {
      role: "ACCEPTANCE",
      content: `${role === "CUSTOMER" ? "Customer" : "Merchant"} accepted ₹${(suggestedPrice / 100).toLocaleString()}/unit`,
      timestamp: new Date().toISOString(),
      acceptedBy: role,
      acceptedPrice: suggestedPrice,
    };

    messages.push(acceptanceMessage);

    // If both parties accepted, finalize the deal
    if (otherPartyAccepted) {
      const dealConfirmedMessage: NegotiationMessage = {
        role: "AI",
        content: `🎉 Deal confirmed! Both parties agreed on ₹${(suggestedPrice / 100).toLocaleString()}/unit. ${role === "CUSTOMER" ? "You can now proceed to checkout with this price." : "The customer can now checkout with the negotiated price."}`,
        timestamp: new Date().toISOString(),
      };
      messages.push(dealConfirmedMessage);

      await prisma.negotiation.update({
        where: { id },
        data: {
          messages: messages as unknown as Prisma.InputJsonValue,
          approvedPrice: suggestedPrice,
          status: "ACCEPTED" as NegotiationStatus,
        },
      });

      return NextResponse.json({
        success: true,
        bothAccepted: true,
        finalPrice: suggestedPrice,
      });
    }

    // Only one party accepted so far
    const waitingMessage: NegotiationMessage = {
      role: "AI",
      content: `Waiting for ${role === "CUSTOMER" ? "merchant" : "customer"} to accept...`,
      timestamp: new Date().toISOString(),
    };
    messages.push(waitingMessage);

    await prisma.negotiation.update({
      where: { id },
      data: { messages: messages as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      success: true,
      bothAccepted: false,
      waitingFor: role === "CUSTOMER" ? "MERCHANT" : "CUSTOMER",
    });
  } catch (error) {
    console.error("Failed to accept price:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to accept price." } },
      { status: 500 }
    );
  }
}

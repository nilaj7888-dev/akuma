import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

/**
 * Simple AI negotiation response generator
 * Analyzes customer offer and suggests fair price based on merchant policy
 */
async function generateNegotiationResponse(
  negotiationId: string,
  customerOffer: string,
  originalPrice: number,
  quantity: number
): Promise<{ content: string; suggestedPrice?: number }> {
  // Extract price from customer message
  const priceMatch = customerOffer.match(/(\d+)/g);
  if (!priceMatch) {
    return {
      content:
        "I understand you're interested. Could you tell me what price per unit you're looking for?",
    };
  }

  const offeredPrice = parseInt(priceMatch[priceMatch.length - 1]) * 100; // Convert to paise
  const discountPercent = Math.round(
    ((originalPrice - offeredPrice) / originalPrice) * 100
  );

  if (discountPercent > 50) {
    // Offer too low
    const suggestedPrice = Math.round(originalPrice * 0.8); // Suggest 20% off
    return {
      content: `I appreciate your interest! ₹${(offeredPrice / 100).toLocaleString()} is quite steep of a discount. How about ₹${(suggestedPrice / 100).toLocaleString()} per unit? That's ${Math.round(((originalPrice - suggestedPrice) / originalPrice) * 100)}% off and fair for both of us.`,
      suggestedPrice,
    };
  } else if (discountPercent > 0) {
    // Reasonable offer
    return {
      content: `Great! ₹${(offeredPrice / 100).toLocaleString()} per unit for ${quantity} units works for me. Both sides seem happy with this price. Would you like to proceed?`,
      suggestedPrice: offeredPrice,
    };
  } else {
    // Price too high or same
    return {
      content: `Thanks for the offer, but that's at or above the list price. Is there a specific budget you had in mind?`,
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      negotiationId?: string;
      role?: "BUYER" | "MERCHANT";
      history?: Array<{ role: string; content: string }>;
    };

    const { message, negotiationId, role } = body;

    if (!message || !negotiationId) {
      return NextResponse.json(
        {
          error: { code: "VALIDATION_ERROR", message: "Missing parameters." },
        },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { error: { code: "DATABASE_REQUIRED", message: "Database required." } },
        { status: 503 }
      );
    }

    // Get negotiation details
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      select: {
        originalPrice: true,
        quantity: true,
        product: { select: { name: true } },
      },
    });

    if (!negotiation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Negotiation not found." } },
        { status: 404 }
      );
    }

    // Generate AI response based on customer offer
    const aiResponse =
      role === "BUYER"
        ? await generateNegotiationResponse(
            negotiationId,
            message,
            negotiation.originalPrice,
            negotiation.quantity
          )
        : {
            content:
              "I've noted your response. Let me see if we can reach a fair agreement.",
          };

    return NextResponse.json({
      content: aiResponse.content,
      message: aiResponse.content,
      suggestedPrice: aiResponse.suggestedPrice,
      success: true,
    });
  } catch (error) {
    console.error("AI negotiation response error:", error);
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: "Failed to generate AI response.",
        },
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(
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
    const negotiation = await prisma.negotiation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        merchantId: true,
        productId: true,
        quantity: true,
        originalPrice: true,
        requestedPrice: true,
        approvedPrice: true,
        status: true,
        messages: true,
        product: { select: { name: true, price: true } },
        merchant: { select: { name: true } },
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

    return NextResponse.json({
      negotiation,
      userRole: isCustomer ? "CUSTOMER" : "MERCHANT",
      messages: Array.isArray(negotiation.messages) ? negotiation.messages : [],
    });
  } catch (error) {
    console.error("Failed to fetch negotiation messages:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to fetch messages." } },
      { status: 500 }
    );
  }
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
    const { content } = await request.json() as { content?: string };

    if (!content || !content.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Message content required.",
          },
        },
        { status: 400 }
      );
    }

    const negotiation = await prisma.negotiation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        merchantId: true,
        messages: true as any,
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

    // Add message to conversation
    const messages = Array.isArray((negotiation as any).messages)
      ? (negotiation as any).messages
      : [];
    const newMessage = {
      role: isCustomer ? "CUSTOMER" : "MERCHANT",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    messages.push(newMessage);

    // Update negotiation with new message
    const updated = await prisma.negotiation.update({
      where: { id },
      data: { messages: messages as any },
      select: {
        messages: true as any,
      },
    });

    // Call AI to generate response
    try {
      const aiResponse = await fetch(
        `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/api/negotiation/ai-response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            negotiationId: id,
            role: isCustomer ? "BUYER" : "MERCHANT",
            history: messages,
          }),
        }
      );

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiMessage = {
          role: "AI",
          content: aiData.content || aiData.message || "I'll consider your offer.",
          timestamp: new Date().toISOString(),
          suggestedPrice: aiData.suggestedPrice,
        };

        messages.push(aiMessage);

        // Update with AI response
        await prisma.negotiation.update({
          where: { id },
          data: { messages: messages as any },
        });

        return NextResponse.json({
          success: true,
          userMessage: newMessage,
          aiMessage,
          allMessages: messages,
        });
      } else {
        console.error("AI response error:", await aiResponse.text());
      }
    } catch (aiError) {
      console.error("AI call error:", aiError);
      // Continue without AI response - just store user message
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
      messages: (updated as any).messages,
    });
  } catch (error) {
    console.error("Failed to add message:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to add message." } },
      { status: 500 }
    );
  }
}

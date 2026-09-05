import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { groqChat } from "@/ai/llm/groq-client";
import { groqConfigured } from "@/ai/llm/model-config";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } },
        { status: 401 }
      );
    }

    if (session.accountType !== "MERCHANT") {
      return NextResponse.json(
        { error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } },
        { status: 403 }
      );
    }

    if (!groqConfigured()) {
      return NextResponse.json(
        { error: { code: "AKUMA_AI_OFFLINE", message: "AI not configured." } },
        { status: 503 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { error: { code: "AKUMA_DATABASE_REQUIRED", message: "Database required." } },
        { status: 503 }
      );
    }

    // Get merchant
    const merchant = await prisma.merchant.findFirst({
      where: { users: { some: { id: session.userId || "" } } },
      select: { id: true, name: true, email: true },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } },
        { status: 404 }
      );
    }

    // Get merchant's data for analysis
    const [products, orders, customers, buyerInterests] = await Promise.all([
      prisma.product.findMany({
        where: { merchantId: merchant.id },
        select: { id: true, name: true, category: true, price: true, stock: true, active: true },
      }),
      prisma.order.findMany({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, amount: true, status: true, createdAt: true },
      }),
      prisma.customer.findMany({
        where: { merchantId: merchant.id },
        take: 5,
        select: { name: true, lifetimeValue: true },
      }),
      prisma.buyerInterest.findMany({
        where: { merchantId: merchant.id, status: "OPEN" },
        select: { id: true, productId: true, quantity: true, preferredPrice: true },
      }),
    ]);

    // Prepare data for AI analysis
    const merchantData = {
      businessName: merchant.name,
      productsCount: products.length,
      products: products.slice(0, 5).map((p) => ({
        name: p.name,
        category: p.category,
        price: p.price / 100,
        stock: p.stock,
      })),
      ordersCount: orders.length,
      recentOrders: orders.slice(0, 3).map((o) => ({
        amount: o.amount / 100,
        status: o.status,
      })),
      customersCount: customers.length,
      totalCustomerValue: customers.reduce((sum, c) => sum + c.lifetimeValue, 0) / 100,
      buyerInterestsCount: buyerInterests.length,
      buyerInterests: buyerInterests.slice(0, 3),
    };

    // Call Groq AI for analysis
    const analysisPrompt = `You are AKUMA, a commerce intelligence AI. Analyze this merchant's data and identify 2-3 revenue opportunities.

Merchant Data:
${JSON.stringify(merchantData, null, 2)}

Based on this data, identify:
1. Revenue opportunities (upsell, cross-sell, inventory clearing, new customer acquisition)
2. For each opportunity: title, description, confidence (1-100), expected revenue increase in rupees, recommended action

Return ONLY valid JSON array with this structure:
[
  {
    "type": "UPSELL" | "CROSS_SELL" | "BUNDLE" | "REACTIVATION" | "CAMPAIGN" | "BUYER_DEMAND_MATCH",
    "title": "string",
    "description": "string",
    "confidence": number (1-100),
    "expectedRevenue": number (in rupees),
    "expectedLift": number (percentage),
    "riskScore": number (1-100),
    "marginImpact": number (in rupees),
    "evidence": { "reason": "string", "data": "string" },
    "recommendedAction": "string"
  }
]`;

    const aiResponse = await groqChat({
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.7,
    });

    // Parse AI response
    let opportunities: unknown[] = [];
    const responseText = aiResponse.content || "";

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        opportunities = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        opportunities = [];
      }
    }

    // Create opportunity records in database
    const createdOpportunities = [];
    for (const opp of opportunities) {
      const oppData = opp as Record<string, unknown>;
      try {
        const created = await prisma.opportunity.create({
          data: {
            merchantId: merchant.id,
            type: (oppData.type as string) || "CAMPAIGN",
            title: (oppData.title as string) || "Opportunity",
            description: (oppData.description as string) || "",
            confidence: (oppData.confidence as number) || 50,
            expectedRevenue: Math.round(((oppData.expectedRevenue as number) || 0) * 100),
            expectedLift: (oppData.expectedLift as number) || 0,
            riskScore: (oppData.riskScore as number) || 50,
            marginImpact: Math.round(((oppData.marginImpact as number) || 0) * 100),
            evidence: (oppData.evidence as Record<string, unknown>) || {},
            status: "DISCOVERED",
          },
        });
        createdOpportunities.push(created);
      } catch (dbError) {
        console.error("Failed to create opportunity:", dbError);
      }
    }

    return NextResponse.json({
      success: true,
      opportunitiesCreated: createdOpportunities.length,
      opportunities: createdOpportunities,
      message: `${createdOpportunities.length} opportunities found and saved.`,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: {
          code: "AKUMA_ANALYSIS_ERROR",
          message: "Analysis failed. Please try again.",
          detail,
        },
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant dashboard only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    // Find merchant by username (email in this system)
    const merchant = await prisma.merchant.findUnique({
      where: { email: session.username }
    });
    if (!merchant) return NextResponse.json({ matches: [], metrics: { totalMatches: 0, highConfidence: 0, potentialRevenue: 0 } });

    // Fetch BUYER_DEMAND_MATCH opportunities for this merchant
    const opportunities = await prisma.opportunity.findMany({
      where: {
        merchantId: merchant.id,
        type: "BUYER_DEMAND_MATCH"
      },
      include: {
        merchant: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    // Also fetch buyer interests that match merchant's products
    const buyerInterests = await prisma.buyerInterest.findMany({
      where: {
        status: "OPEN",
        merchantId: { not: merchant.id }, // Only from other merchants' buyers
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: {
          include: {
            merchant: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    // Calculate matches against merchant's products
    const merchantProducts = await prisma.product.findMany({
      where: { merchantId: merchant.id, active: true },
      select: { id: true, name: true, category: true, price: true, description: true }
    });

    const potentialMatches = buyerInterests.map(interest => {
      const matches = merchantProducts.filter(product => {
        // Simple matching logic (matching lib/product-matching.ts)
        const productNameLower = product.name.toLowerCase();
        const interestNameLower = interest.product.name.toLowerCase();
        const productCategoryLower = product.category.toLowerCase();
        const interestCategoryLower = interest.product.category.toLowerCase();

        let matchScore = 0;
        const matchReasons: string[] = [];

        // Category match (40 points)
        if (productCategoryLower === interestCategoryLower) {
          matchScore += 40;
          matchReasons.push("Category matches");
        }

        // Name/keyword match (30 points)
        if (
          productNameLower.includes(interestNameLower) ||
          interestNameLower.includes(productNameLower) ||
          productNameLower.split(/\s+/).some(word => interestNameLower.includes(word))
        ) {
          matchScore += 30;
          matchReasons.push("Product name/keyword matches");
        }

        // Budget compatibility (20 points)
        if (interest.preferredPrice) {
          const buyerBudgetPerUnit = interest.preferredPrice / interest.quantity;
          const productPricePerUnit = product.price;

          // Budget within 90% of product price
          if (buyerBudgetPerUnit >= productPricePerUnit * 0.9) {
            matchScore += 20;
            matchReasons.push("Budget compatible");
          }
        }

        // Quantity bonus (10 points)
        if (matchScore > 0) {
          matchScore += 10;
          matchReasons.push(`Quantity: ${interest.quantity} units`);
        }

        return matchScore >= 50;
      });

      if (matches.length > 0) {
        // Find the best matching product
        const bestMatch = matches[0]; // Simplified - would need scoring
        return {
          buyerInterestId: interest.id,
          buyerId: interest.user.id,
          buyerName: interest.user.name || "Buyer",
          buyerEmail: interest.user.email,
          originalProduct: {
            name: interest.product.name,
            merchant: interest.product.merchant.name,
            price: interest.product.price,
          },
          matchedProduct: {
            id: bestMatch.id,
            name: bestMatch.name,
            price: bestMatch.price,
          },
          quantity: interest.quantity,
          preferredPrice: interest.preferredPrice,
          matchScore: 75, // Simplified score
          matchReasons: ["Category match", "Budget compatible"],
          createdAt: interest.createdAt,
          status: interest.status,
        };
      }
      return null;
    }).filter(Boolean);

    // Calculate metrics
    const totalMatches = opportunities.length + potentialMatches.length;
    const highConfidence = opportunities.filter(o => o.confidence >= 80).length;
    const potentialRevenue = opportunities.reduce((sum, o) => sum + (o.expectedRevenue || 0), 0) / 100;

    return NextResponse.json({
      opportunities: opportunities.map(opp => ({
        id: opp.id,
        title: opp.title,
        description: opp.description,
        confidence: opp.confidence,
        expectedRevenue: opp.expectedRevenue / 100,
        evidence: opp.evidence,
        createdAt: opp.createdAt,
        status: opp.status,
      })),
      potentialMatches,
      metrics: {
        totalMatches,
        highConfidence,
        potentialRevenue,
        readyToAct: opportunities.filter(o => o.status === "DISCOVERED").length,
      }
    });
  } catch (error) {
    console.error("Error fetching demand matches:", error);
    return NextResponse.json({
      error: {
        code: "AKUMA_SERVER_ERROR",
        message: "Failed to load demand matching data."
      }
    }, { status: 500 });
  }
}
import { PrismaClient } from "@prisma/client";

interface MatchResult {
  buyerInterestId: string;
  buyerId: string;
  userId: string;
  productName: string;
  quantity: number;
  preferredPrice: number | null;
  matchScore: number;
  matchReasons: string[];
}

/** Minimum score for a match to count: category (40) + at least one other factor. */
export const MATCH_THRESHOLD = 50;

/** The demand signal carried by a BuyerInterest: what the buyer is looking for. */
interface InterestSignal {
  /** Category of the product the buyer expressed interest in. */
  category: string;
  /** Name of the product the buyer expressed interest in (used for keyword overlap). */
  name: string;
  /** Buyer's preferred total price in paise, if stated. */
  preferredPrice: number | null;
  /** Units wanted (used to derive per-unit budget). */
  quantity: number;
}

/** The product being scored against the demand signal. Price is per-unit paise. */
interface ProductSignal {
  category: string;
  name: string;
  price: number;
}

/**
 * The single source of truth for how well a buyer's demand matches a product.
 * Both matching directions — product → interested buyers (merchant
 * opportunities) and interest → products (the buyer's Discover feed) — call
 * THIS function so there is exactly one algorithm and one set of weights.
 *
 * Weights: category 40, name/keyword 30, budget 20, quantity 10.
 */
export function scoreInterestAgainstProduct(
  interest: InterestSignal,
  product: ProductSignal
): { score: number; reasons: string[] } {
  const productNameLower = product.name.toLowerCase();
  const productCategoryLower = product.category.toLowerCase();
  const interestNameLower = interest.name.toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  // 1. Category match (weight: 40)
  if (interest.category.toLowerCase() === productCategoryLower) {
    score += 40;
    reasons.push("Category matches");
  }

  // 2. Name/keyword match (weight: 30)
  if (
    productNameLower.includes(interestNameLower) ||
    interestNameLower.includes(productNameLower) ||
    productNameLower.split(/\s+/).some((word) => interestNameLower.includes(word))
  ) {
    score += 30;
    reasons.push("Product name/keyword matches");
  }

  // 3. Budget compatibility (weight: 20)
  if (interest.preferredPrice) {
    const buyerBudgetPerUnit = interest.preferredPrice / interest.quantity;
    // Product is affordable if the buyer's per-unit budget is within 90% of
    // the price (leaving a little negotiation room).
    if (buyerBudgetPerUnit >= product.price * 0.9) {
      score += 20;
      reasons.push("Budget compatible");
    }
  }

  // 4. Quantity available (weight: 10) — only when there's already some match.
  if (score > 0) {
    score += 10;
    reasons.push(`Quantity: ${interest.quantity} units needed`);
  }

  return { score, reasons };
}

/** A product surfaced to a buyer because it matches one of their interests. */
export interface BuyerProductMatch {
  productId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string | null;
  merchantName: string;
  matchScore: number;
  matchReasons: string[];
  /** The BuyerInterest that drove this match (highest-scoring one). */
  buyerInterestId: string;
}

/**
 * Customer-facing direction: given a buyer, find the real, active products that
 * best match their OPEN interests. This is the exact inverse of
 * findMatchingBuyerInterests and shares its scoring via
 * scoreInterestAgainstProduct — no second algorithm.
 *
 * Authorization: scoped to the passed userId. Only active, in-stock products
 * across all merchants are considered (a buyer discovers the whole marketplace).
 */
export async function findMatchingProductsForBuyer(
  prisma: PrismaClient,
  userId: string,
  opts: { limit?: number } = {}
): Promise<BuyerProductMatch[]> {
  const limit = opts.limit ?? 20;
  try {
    // The buyer's active demand. Each interest references a product whose
    // category/name describe what they're after.
    const interests = await prisma.buyerInterest.findMany({
      where: { userId, status: "OPEN" },
      include: { product: { select: { category: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    if (interests.length === 0) return [];

    // Candidate catalog: real, purchasable products only.
    const candidates = await prisma.product.findMany({
      where: { active: true, stock: { gt: 0 } },
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        stock: true,
        description: true,
        merchant: { select: { name: true } },
      },
      take: 200,
    });

    const matches: BuyerProductMatch[] = [];

    for (const product of candidates) {
      let bestScore = 0;
      let bestReasons: string[] = [];
      let bestInterestId = "";

      for (const interest of interests) {
        if (!interest.product) continue;
        const { score, reasons } = scoreInterestAgainstProduct(
          {
            category: interest.product.category,
            name: interest.product.name,
            preferredPrice: interest.preferredPrice,
            quantity: interest.quantity,
          },
          { category: product.category, name: product.name, price: product.price }
        );
        if (score > bestScore) {
          bestScore = score;
          bestReasons = reasons;
          bestInterestId = interest.id;
        }
      }

      if (bestScore >= MATCH_THRESHOLD) {
        matches.push({
          productId: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          stock: product.stock,
          description: product.description,
          merchantName: product.merchant?.name ?? "Unknown merchant",
          matchScore: bestScore,
          matchReasons: bestReasons,
          buyerInterestId: bestInterestId,
        });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
  } catch (error) {
    console.error("Error finding matching products for buyer:", error);
    return [];
  }
}

/**
 * Find BuyerInterest records that match a newly created product
 * Matches by: category, keywords, budget, quantity, location (if available)
 */
export async function findMatchingBuyerInterests(
  prisma: PrismaClient,
  productId: string,
  merchantId: string
): Promise<MatchResult[]> {
  try {
    // Fetch the new product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, category: true, price: true, description: true },
    });

    if (!product) return [];

    // Search for open buyer interests from OTHER merchants (not this merchant's own interests)
    const buyerInterests = await prisma.buyerInterest.findMany({
      where: {
        status: "OPEN",
        merchantId: { not: merchantId }, // Different merchant's buyers
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { category: true, name: true } },
      },
      take: 50, // Limit search to prevent expensive queries
    });

    const matches: MatchResult[] = [];

    for (const interest of buyerInterests) {
      // Same scoring as the buyer-facing direction — one shared algorithm.
      const { score: matchScore, reasons } = scoreInterestAgainstProduct(
        {
          category: interest.product.category,
          name: interest.product.name,
          preferredPrice: interest.preferredPrice,
          quantity: interest.quantity,
        },
        { category: product.category, name: product.name, price: product.price }
      );

      // Only include matches with score >= threshold (category + one other factor)
      if (matchScore >= MATCH_THRESHOLD) {
        matches.push({
          buyerInterestId: interest.id,
          buyerId: interest.userId,
          userId: interest.userId,
          productName: interest.product.name,
          quantity: interest.quantity,
          preferredPrice: interest.preferredPrice,
          matchScore,
          matchReasons: reasons,
        });
      }
    }

    // Sort by match score descending
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    console.error("Error finding matching buyer interests:", error);
    return [];
  }
}

/**
 * Create merchant opportunities for matched buyer demands
 * Reuses existing Opportunity system with type: BUYER_DEMAND_MATCH
 */
export async function createDemandMatchOpportunities(
  prisma: PrismaClient,
  productId: string,
  merchantId: string,
  matches: MatchResult[]
): Promise<string[]> {
  if (matches.length === 0) return [];

  const opportunityIds: string[] = [];

  for (const match of matches) {
    try {
      const opportunity = await prisma.opportunity.create({
        data: {
          merchantId,
          type: "BUYER_DEMAND_MATCH",
          title: `Buyer interested in your new product: ${match.productName}`,
          description: `A buyer is looking for "${match.productName}" and may be interested in your new product.\n\nBuyer demand:\n- Quantity: ${match.quantity} units\n- Budget: ₹${match.preferredPrice ? (match.preferredPrice / 100).toLocaleString("en-IN") : "Not specified"}\n\nMatch reasons: ${match.matchReasons.join(", ")}\n\nYou can reach out to this buyer with an offer through the system.`,
          confidence: Math.min(100, Math.round(match.matchScore)),
          expectedRevenue: match.preferredPrice ? match.preferredPrice * match.quantity : 0,
          expectedLift: 0,
          riskScore: 20,
          marginImpact: 0,
          status: "DISCOVERED",
          evidence: {
            productId,
            buyerInterestId: match.buyerInterestId,
            buyerId: match.userId,
            matchScore: match.matchScore,
            matchReasons: match.matchReasons,
            quantity: match.quantity,
            preferredPrice: match.preferredPrice,
          },
        },
      });

      opportunityIds.push(opportunity.id);

      // Create notification for merchant
      await prisma.notification.create({
        data: {
          merchantId,
          type: "BUYER_INTEREST_NEW",
          title: "New buyer demand match",
          message: `A buyer looking for "${match.productName}" may be interested in your new product (${match.matchScore}% match)`,
          resourceType: "OPPORTUNITY",
          resourceId: opportunity.id,
          actionUrl: `/dashboard/opportunities?type=BUYER_DEMAND_MATCH`,
          metadata: {
            productId,
            buyerInterestId: match.buyerInterestId,
            matchScore: match.matchScore,
          },
        },
      });
    } catch (error) {
      console.error(`Error creating opportunity for match ${match.buyerInterestId}:`, error);
    }
  }

  return opportunityIds;
}

/**
 * Integrates into product creation: find matches and create opportunities
 * Call this after saving a new product
 */
export async function matchNewProductToDemand(
  prisma: PrismaClient,
  productId: string,
  merchantId: string
): Promise<{ matchCount: number; opportunityCount: number }> {
  try {
    const matches = await findMatchingBuyerInterests(prisma, productId, merchantId);
    const opportunityIds = await createDemandMatchOpportunities(prisma, productId, merchantId, matches);

    return {
      matchCount: matches.length,
      opportunityCount: opportunityIds.length,
    };
  } catch (error) {
    console.error("Error matching new product to demand:", error);
    return { matchCount: 0, opportunityCount: 0 };
  }
}

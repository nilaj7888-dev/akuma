import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { haversineDistanceKm } from "@/lib/geo";

// Check if buyer is within delivery range
function isWithinDeliveryRange(merchantLocation: { lat: number; lon: number; radius: string }, buyerLocation: { lat?: number; lon?: number } | null): boolean {
  if (merchantLocation.radius === "nationwide") return true;
  if (!buyerLocation?.lat || !buyerLocation?.lon) return false;

  const distance = haversineDistanceKm(merchantLocation.lat, merchantLocation.lon, buyerLocation.lat, buyerLocation.lon);

  switch (merchantLocation.radius) {
    case "local_pickup":
      return distance < 2;
    case "5km":
      return distance <= 5;
    case "15km":
      return distance <= 15;
    default:
      return false;
  }
}

// Calculate match score
function calculateMatchScore(product: { name: string; category: string; price: number }, interest: {
  productName?: string;
  category?: string;
  budget?: number;
  quantity?: number;
}): number {
  let score = 0;

  // Category match
  if (interest.category?.toLowerCase() === product.category.toLowerCase()) score += 40;
  else if (interest.category && product.category.toLowerCase().includes(interest.category.toLowerCase())) score += 25;

  // Product name/keyword match
  if (interest.productName) {
    const keywords = interest.productName.toLowerCase().split(" ");
    const productWords = product.name.toLowerCase().split(" ");
    const matches = keywords.filter((k) => productWords.some((w) => w.includes(k))).length;
    score += Math.min((matches / keywords.length) * 40, 40);
  }

  // Budget match
  if (interest.budget && product.price <= interest.budget) score += 20;
  else if (interest.budget && product.price <= interest.budget * 1.2) score += 10;

  return Math.min(score, 100);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { id: session.userId || "" } });
  const merchant = user ? await prisma.merchant.findUnique({ where: { id: user.merchantId || "" } }) : null;
  if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

  // Get all buyer interests
  const buyerInterests = await prisma.buyerInterest.findMany({
    where: { merchantSeen: false },
    include: { user: true },
  });

  // Get merchant products
  const products = await prisma.product.findMany({
    where: { merchantId: merchant.id, active: true },
  });

  const matches = [];

  for (const interest of buyerInterests) {
    for (const product of products) {
      const interestReqs = (interest.requirements as Record<string, unknown>) || {};
      const matchScore = calculateMatchScore(
        { name: product.name, category: product.category, price: product.price },
        {
          productName: interestReqs.productName as string | undefined,
          category: interestReqs.category as string | undefined,
          budget: interest.preferredPrice || undefined,
          quantity: interest.quantity,
        }
      );

      if (matchScore >= 60) {
        // Check delivery range
        const buyerReqs = (interest.requirements as Record<string, unknown>) || {};
        const isInRange = !merchant.latitude
          ? true
          : isWithinDeliveryRange(
              {
                lat: merchant.latitude,
                lon: merchant.longitude!,
                radius: merchant.deliveryRadius || "nationwide",
              },
              { lat: buyerReqs.latitude as number | undefined, lon: buyerReqs.longitude as number | undefined }
            );

        if (isInRange) {
          matches.push({
            interestId: interest.id,
            productId: product.id,
            productName: product.name,
            buyerName: interest.user?.name || "Unknown",
            quantity: interest.quantity,
            budget: interest.preferredPrice,
            matchScore,
            matchReasons: [
              matchScore >= 80 ? "Excellent match" : "Good match",
              "Category/keyword match",
              interest.preferredPrice ? "Budget compatible" : undefined,
            ].filter(Boolean),
          });
        }
      }
    }
  }

  return NextResponse.json({ matches: matches.sort((a, b) => b.matchScore - a.matchScore) });
}

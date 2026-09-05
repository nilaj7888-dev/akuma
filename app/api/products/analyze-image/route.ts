import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// POST /api/products/analyze-image - Analyze product image with AI vision
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  }

  if (session.accountType !== "MERCHANT") {
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchants only." } }, { status: 403 });
  }

  const { imageUrl } = await request.json() as { imageUrl: string };
  if (!imageUrl) {
    return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Image URL required." } }, { status: 400 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "Database required." } }, { status: 503 });
  }

  // Resolve the merchant leniently. `session.username` is a User id for the
  // email/OTP flow and an email for the Google flow, so a Merchant lookup by
  // that value alone returns nothing for most sign-ins. The analyzer only needs
  // a display name, so fall back instead of failing the request.
  const userId = session.userId ?? session.username;
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { merchantId: true } })
    : null;

  const merchant =
    (user?.merchantId
      ? await prisma.merchant.findUnique({
          where: { id: user.merchantId },
          select: { id: true, name: true },
        })
      : null) ??
    (session.username.includes("@")
      ? await prisma.merchant.findUnique({
          where: { email: session.username },
          select: { id: true, name: true },
        })
      : null) ??
    (await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
      select: { id: true, name: true },
    })) ??
    { id: "", name: "your store" };

  // Heuristic analysis from the filename. Not a vision model: the Groq text
  // models AKUMA uses (see ai/llm/model-config.ts) can't read images, so
  // wiring this to a real vision model is still outstanding.
  try {
    const analysis = await analyzeProductImage(imageUrl, merchant);

    return NextResponse.json({
      success: true,
      suggestedName: analysis.name,
      suggestedCategory: analysis.category,
      suggestedDescription: analysis.description,
      suggestedPrice: analysis.price,
      confidence: analysis.confidence,
      message: "Review and adjust the suggestions, then create your product.",
    });
  } catch (error) {
    console.error("Image analysis error:", error);
    return NextResponse.json({
      error: { code: "AKUMA_ANALYSIS_FAILED", message: "Could not analyze this image." },
    }, { status: 500 });
  }
}

async function analyzeProductImage(imageUrl: string, merchant: { id: string; name: string }) {
  // Extract filename/path for hints
  const urlLower = imageUrl.toLowerCase();
  const filename = urlLower.split("/").pop() || "";

  // Try to infer from filename/URL
  const keywords = filename.replace(/[-_]/g, " ").replace(/\.\w+$/, "").split(" ");

  // Common categories and their keywords
  const categoryKeywords: Record<string, string[]> = {
    "Electronics": ["phone", "laptop", "headphone", "earphone", "speaker", "cable", "charger", "watch", "tablet", "camera", "tv", "monitor"],
    "Fashion": ["shirt", "tshirt", "jeans", "dress", "shoe", "sneaker", "jacket", "coat", "kurta", "saree", "pant"],
    "Furniture": ["chair", "table", "sofa", "bed", "cabinet", "shelf", "desk", "lamp"],
    "Food": ["snack", "chocolate", "coffee", "tea", "spice", "oil", "sauce", "noodle", "biscuit"],
    "Beauty": ["cream", "lotion", "serum", "makeup", "lipstick", "perfume", "shampoo"],
    "Sports": ["bat", "ball", "racket", "cycle", "gym", "fitness", "yoga"],
    "Books": ["book", "novel", "textbook", "guide"],
  };

  let category = "Electronics"; // default
  let matchedCategory = false;
  for (const [cat, terms] of Object.entries(categoryKeywords)) {
    if (terms.some(term => keywords.some(k => k.includes(term)))) {
      category = cat;
      matchedCategory = true;
      break;
    }
  }

  // Infer product name from filename
  const name = keywords.length > 0
    ? keywords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "Product";

  // Default price ranges by category (in paise)
  const defaultPrices: Record<string, number> = {
    "Electronics": 299900, // ₹2999
    "Fashion": 99900,      // ₹999
    "Furniture": 499900,   // ₹4999
    "Food": 19900,         // ₹199
    "Beauty": 39900,       // ₹399
    "Sports": 149900,      // ₹1499
    "Books": 29900,        // ₹299
  };

  const description = matchedCategory
    ? `High-quality ${name} from ${merchant.name}. ${category} product.`
    : `Quality product from ${merchant.name}.`;

  return {
    name,
    category,
    description,
    price: defaultPrices[category] || 99900,
    confidence: matchedCategory ? 0.7 : 0.4,
  };
}
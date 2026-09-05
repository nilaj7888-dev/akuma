import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInventoryAnalysis } from "@/lib/inventory";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const createProductSchema = z.object({
  name: z.string().min(1, "Product name required"),
  category: z.string().min(1, "Category required"),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  price: z.number().int().positive("Price must be positive"),
  cost: z.number().int().nonnegative("Cost must be non-negative").optional(),
  stock: z.number().int().nonnegative("Stock must be non-negative"),
  specifications: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.string().length(0)),
});

const DEMO_MERCHANT_EMAIL = "demo@nova-electronics.test";

type SessionLike = NonNullable<Awaited<ReturnType<typeof getSession>>>;
type PrismaLike = NonNullable<ReturnType<typeof getPrisma>>;

/**
 * Resolve the merchant workspace for the signed-in session.
 *
 * `session.username` is NOT always an email: the email/OTP flow calls
 * createSession(user.id, ...), so it is a User id there, while the Google flow
 * puts the user's email in it. Looking a Merchant up by that value alone
 * therefore failed (404) for every OTP login. Resolve by the user's own
 * merchantId first, then by username-as-email, then fall back to the seeded
 * demo workspace.
 *
 * GET and POST MUST share this helper: if listing and creating resolve
 * different merchants, a saved product never shows up in the inventory table.
 *
 * Only `id` is selected: this repo has a history of schema/database drift, and
 * selecting whole Merchant rows makes this fail whenever a column exists in
 * schema.prisma but not yet in the database.
 */
async function resolveMerchant(prisma: PrismaLike, session: SessionLike) {
  const userId = session.userId ?? session.username;

  // For demo sessions (isDemo flag), create merchant on-the-fly
  if (session.isDemo && session.accountType === "MERCHANT") {
    const demoMerchantName = session.name || "Demo Store";
    const demoEmail = `demo_${session.userId || session.username}@akuma.local`;

    // Try to find existing demo merchant for this session
    let merchant = await prisma.merchant.findFirst({
      where: { email: demoEmail },
      select: { id: true },
    });

    if (!merchant) {
      // Create a new merchant for this demo session
      merchant = await prisma.merchant.create({
        data: {
          name: demoMerchantName,
          email: demoEmail,
        },
        select: { id: true },
      });
      console.log(`[resolveMerchant] Created demo merchant: ${merchant.id}`);
    }

    return merchant;
  }

  // For real users (non-demo)
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, merchantId: true, name: true, email: true },
    });
    if (user?.merchantId) {
      const owned = await prisma.merchant.findUnique({
        where: { id: user.merchantId },
        select: { id: true },
      });
      if (owned) return owned;
    }
    // If user exists but has no merchantId, create a merchant for them
    if (user && !user.merchantId) {
      const merchant = await prisma.merchant.create({
        data: {
          name: user.name || "My Store",
          email: user.email || `merchant-${user.id}@akuma.app`,
        },
        select: { id: true },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { merchantId: merchant.id },
      });
      return merchant;
    }
  }

  if (session.username?.includes("@")) {
    const byEmail = await prisma.merchant.findUnique({
      where: { email: session.username },
      select: { id: true },
    });
    if (byEmail) return byEmail;
  }

  return prisma.merchant.findUnique({
    where: { email: DEMO_MERCHANT_EMAIL },
    select: { id: true },
  });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await resolveMerchant(prisma, session);
    if (!merchant) return NextResponse.json([]);

    const inventory = await getInventoryAnalysis(merchant.id);

    // Shape this for the inventory table, which reads price/stock/sold and a
    // margin percentage. getInventoryAnalysis returns unitPrice/currentStock/
    // unitsSold and an absolute rupee margin.
    return NextResponse.json(
      inventory.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        price: item.unitPrice,
        stock: item.currentStock,
        sold: item.unitsSold,
        margin: item.unitPrice > 0 ? Math.round(((item.unitPrice - item.unitCost) / item.unitPrice) * 100) : 0,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in required." } },
        { status: 401 }
      );
    }

    if (session.accountType !== "MERCHANT") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Merchants only." } },
        { status: 403 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { error: { code: "DATABASE_REQUIRED", message: "Database required." } },
        { status: 503 }
      );
    }

    const merchant = await resolveMerchant(prisma, session);

    if (!merchant) {
      return NextResponse.json(
        { error: { code: "MERCHANT_NOT_FOUND", message: "Merchant not found." } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid product data",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { name, category, brand, model, description, price, cost, stock, specifications, imageUrl } = parsed.data;

    // Generate SKU from name + timestamp
    const sku = `${name.substring(0, 3).toUpperCase()}-${Date.now()}`;

    // Check for duplicate SKU
    const existingSku = await prisma.product.findFirst({
      where: {
        merchantId: merchant.id,
        sku,
      },
    });

    if (existingSku) {
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_SKU",
            message: `SKU "${sku}" already exists.`,
          },
        },
        { status: 409 }
      );
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        merchantId: merchant.id,
        name,
        category,
        sku,
        price,
        cost: cost || 0,
        stock,
        description: description || null,
        imageUrl: imageUrl || null,
        active: true,
        metadata: {
          brand: brand || null,
          model: model || null,
          specifications: specifications || null,
        },
      },
    });

    // Return the row in the same shape GET uses so the client can display it
    // immediately without re-deriving units.
    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        price: product.price / 100,
        stock: product.stock,
        sold: 0,
        margin: product.price > 0 ? Math.round(((product.price - product.cost) / product.price) * 100) : 0,
      },
    });
  } catch (error: any) {
    console.error("Product creation error:", error);
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: error.message || "Failed to create product.",
        },
      },
      { status: 500 }
    );
  }
}

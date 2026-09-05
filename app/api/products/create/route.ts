import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { matchNewProductToDemand } from "@/lib/product-matching";
import { z } from "zod";

const createProductSchema = z.object({
  name: z.string().min(1, "Product name required"),
  category: z.string().min(1, "Category required"),
  sku: z.string().min(1, "SKU required"),
  price: z.number().int().positive("Price must be positive"),
  cost: z.number().int().nonnegative("Cost must be non-negative"),
  stock: z.number().int().nonnegative("Stock must be non-negative"),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.string().length(0)),
});

export async function POST(request: Request) {
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
        { error: { code: "AKUMA_FORBIDDEN", message: "Merchants only." } },
        { status: 403 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { error: { code: "AKUMA_DATABASE_REQUIRED", message: "Database required." } },
        { status: 503 }
      );
    }

    // Get merchant by username (which serves as email in this demo system)
    const merchant = await prisma.merchant.findUnique({
      where: { email: session.username },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "AKUMA_VALIDATION_ERROR",
            message: "Invalid product data",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { name, category, sku, price, cost, stock, description, imageUrl } = parsed.data;

    // Check for duplicate SKU within merchant's products
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
            code: "AKUMA_DUPLICATE_SKU",
            message: `SKU "${sku}" already exists for this merchant.`,
          },
        },
        { status: 409 }
      );
    }

    // Create product and run demand matching
    const product = await prisma.product.create({
      data: {
        merchantId: merchant.id,
        name,
        category,
        sku,
        price,
        cost,
        stock,
        description: description || null,
        imageUrl: imageUrl || null,
        active: true,
      },
    });

    // Find matching buyer interests and create opportunities
    const matchingResult = await matchNewProductToDemand(prisma, product.id, merchant.id);

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        category: product.category,
        sku: product.sku,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        description: product.description,
        imageUrl: product.imageUrl,
      },
      demandMatching: {
        matchCount: matchingResult.matchCount,
        opportunityCount: matchingResult.opportunityCount,
        message:
          matchingResult.opportunityCount > 0
            ? `${matchingResult.opportunityCount} buyer demand match opportunity created. Check "What To Do Today" in your dashboard.`
            : "No matching buyer demand found at this time.",
      },
    });
  } catch (error: unknown) {
    console.error("Product creation error:", error);
    return NextResponse.json(
      {
        error: {
          code: "AKUMA_SERVER_ERROR",
          message: (error instanceof Error && error.message) || "Failed to create product.",
        },
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInventoryAnalysis } from "@/lib/inventory";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";
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

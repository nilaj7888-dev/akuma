import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json([], { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase() || "";
    const category = searchParams.get("category") || "";

    // Build where clause for filtering
    const where: Record<string, unknown> = {
      active: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { merchant: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (category) {
      where.category = category;
    }

    // Get all products with merchant info
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        price: true,
        category: true,
        stock: true,
        imageUrl: true,
        description: true,
        merchant: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Get products error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

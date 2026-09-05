import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } },
        { status: 401 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json([], { status: 200 });
    }

    // Get active negotiations based on account type
    const whereClause =
      session.accountType === "MERCHANT"
        ? { merchantId: session.userId || session.username, status: { in: ["OPEN", "CUSTOMER_OFFER", "MERCHANT_COUNTER"] } }
        : { userId: session.userId || session.username, status: { in: ["OPEN", "CUSTOMER_OFFER", "MERCHANT_COUNTER"] } };

    const negotiations = await prisma.negotiation.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        productId: true,
        quantity: true,
        originalPrice: true,
        requestedPrice: true,
        approvedPrice: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            name: true,
            category: true,
            imageUrl: true,
          },
        },
      },
    });

    return NextResponse.json(negotiations);
  } catch (error) {
    console.error("Get active negotiations error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { simulatePriceChange } from "@/lib/pricing";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const body = await request.json() as { productId: string; newPrice: number };
    const { productId, newPrice } = body;

    // Get product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        orderItems: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Calculate sales in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSales = product.orderItems.filter(
      (oi) => oi.order.status === "PAID" && oi.order.createdAt >= thirtyDaysAgo
    );

    const unitsSold = recentSales.reduce((sum, oi) => sum + oi.quantity, 0);

    // Run simulation (price is in paise)
    const simulation = simulatePriceChange(
      product.price,
      newPrice,
      unitsSold,
      product.cost
    );

    // Audit log - convert simulation to JSON-compatible object
    const simulationOutput = {
      currentPrice: simulation.currentPrice,
      newPrice: simulation.newPrice,
      priceChangePercent: simulation.priceChangePercent,
      currentMargin: simulation.currentMargin,
      newMargin: simulation.newMargin,
      estimatedVolumeChange: simulation.estimatedVolumeChange,
      currentRevenue: simulation.currentRevenue,
      projectedRevenue: simulation.projectedRevenue,
      revenueImpact: simulation.revenueImpact,
      currentMarginTotal: simulation.currentMarginTotal,
      projectedMarginTotal: simulation.projectedMarginTotal,
      marginImpact: simulation.marginImpact,
      recommendation: simulation.recommendation,
    };

    await prisma.auditLog.create({
      data: {
        merchantId: product.merchantId,
        actorType: "USER",
        actorId: session.username,
        action: "SIMULATE_PRICE",
        resourceType: "Product",
        resourceId: productId,
        reason: `Simulated price change from ₹${product.price / 100} to ₹${newPrice / 100}`,
        input: { currentPrice: product.price, newPrice },
        output: simulationOutput,
      },
    });

    return NextResponse.json(simulation);
  } catch (error) {
    console.error("Failed to simulate price:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

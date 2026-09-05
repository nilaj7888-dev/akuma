import { getPrisma } from "@/lib/db";

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  unitPrice: number;
  unitCost: number;
  margin: number;
  unitsSold: number;
  salesVelocity: number; // units per day
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "CRITICAL" | "OUT_OF_STOCK" | "EXCESS";
  daysOfInventory: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  recommendation: string;
}

export async function getInventoryAnalysis(merchantId: string): Promise<InventoryProduct[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get all active products with their order items
    const products = await prisma.product.findMany({
      where: { merchantId, active: true },
      include: {
        orderItems: {
          include: {
            order: true,
          },
        },
      },
    });

    const inventory: InventoryProduct[] = [];

    for (const product of products) {
      // Calculate sales in last 30 days from paid orders
      const unitsSoldLast30Days = product.orderItems
        .filter((oi) => oi.order.status === "PAID" && oi.order.createdAt >= thirtyDaysAgo)
        .reduce((sum, oi) => sum + oi.quantity, 0);

      const salesVelocity = unitsSoldLast30Days / 30;
      const margin = product.price - product.cost;
      const marginPercent = ((margin / product.price) * 100) || 0;
      const daysOfInventory = salesVelocity > 0 ? Math.round(product.stock / salesVelocity) : 999;

      // Determine stock status
      let stockStatus: "IN_STOCK" | "LOW_STOCK" | "CRITICAL" | "OUT_OF_STOCK" | "EXCESS" = "IN_STOCK";
      let riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
      let recommendation = "Continue monitoring";

      if (product.stock === 0) {
        stockStatus = "OUT_OF_STOCK";
        riskLevel = "CRITICAL";
        recommendation = "Reorder immediately to avoid lost sales";
      } else if (product.stock < 5) {
        stockStatus = "CRITICAL";
        riskLevel = "CRITICAL";
        recommendation = "Urgent reorder required";
      } else if (product.stock < 10) {
        stockStatus = "LOW_STOCK";
        riskLevel = "HIGH";
        recommendation = "Schedule reorder within 3-5 days";
      } else if (unitsSoldLast30Days === 0 && product.stock > 20) {
        stockStatus = "EXCESS";
        riskLevel = "HIGH";
        recommendation = "Consider promoting or bundling to move inventory";
      } else if (daysOfInventory > 90) {
        stockStatus = "EXCESS";
        riskLevel = "MEDIUM";
        recommendation = "Slow-moving: consider discount or bundle";
      } else if (daysOfInventory < 7 && daysOfInventory > 0) {
        stockStatus = "LOW_STOCK";
        riskLevel = "HIGH";
        recommendation = "Will stockout in ~7 days at current velocity";
      } else if (marginPercent < 15) {
        riskLevel = "MEDIUM";
        recommendation = `Low margin (${Math.round(marginPercent)}%). Consider price increase`;
      }

      inventory.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        currentStock: product.stock,
        unitPrice: product.price / 100,
        unitCost: product.cost / 100,
        margin: Math.round((margin / 100) * 100) / 100,
        unitsSold: unitsSoldLast30Days,
        salesVelocity: Math.round(salesVelocity * 100) / 100,
        stockStatus,
        daysOfInventory,
        riskLevel,
        recommendation,
      });
    }

    // Sort by risk level and stock status
    const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return inventory.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);
  } catch {
    return [];
  }
}

export interface InventorySummary {
  totalProducts: number;
  criticalRiskCount: number;
  highRiskCount: number;
  outOfStockCount: number;
  excessInventoryCount: number;
  totalInventoryValue: number;
  atRiskValue: number;
}

export async function getInventorySummary(merchantId: string): Promise<InventorySummary> {
  const inventory = await getInventoryAnalysis(merchantId);

  const summary: InventorySummary = {
    totalProducts: inventory.length,
    criticalRiskCount: inventory.filter(p => p.riskLevel === "CRITICAL").length,
    highRiskCount: inventory.filter(p => p.riskLevel === "HIGH").length,
    outOfStockCount: inventory.filter(p => p.stockStatus === "OUT_OF_STOCK").length,
    excessInventoryCount: inventory.filter(p => p.stockStatus === "EXCESS").length,
    totalInventoryValue: Math.round(
      inventory.reduce((sum, p) => sum + p.currentStock * p.unitPrice, 0)
    ),
    atRiskValue: Math.round(
      inventory
        .filter(p => p.riskLevel === "CRITICAL" || p.riskLevel === "HIGH")
        .reduce((sum, p) => sum + p.currentStock * p.unitPrice, 0)
    ),
  };

  return summary;
}

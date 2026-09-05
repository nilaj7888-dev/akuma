import { getPrisma } from "@/lib/db";

export interface ProductAffinity {
  purchasedProduct: string;
  purchasedProductName: string;
  recommendedProduct: string;
  recommendedProductName: string;
  coOccurrenceCount: number;
  coOccurrenceRate: number;
  recommendationStrength: number; // 0-100
}

export interface CustomerNextBestProduct {
  customerId: string;
  customerName: string;
  lastPurchasedProducts: string[];
  nextBestProducts: Array<{
    productId: string;
    productName: string;
    price: number;
    stock: number;
    affinity: number;
    reason: string;
  }>;
}

export async function getProductAffinities(merchantId: string): Promise<ProductAffinity[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    // Get all orders with items
    const orders = await prisma.order.findMany({
      where: { merchantId, status: "PAID" },
      include: { items: { include: { product: true } } },
    });

    const affinityMap = new Map<string, { count: number; targetProduct?: { id: string; name: string }; sourceProduct?: { id: string; name: string } }>();

    // Calculate co-purchase pairs
    for (const order of orders) {
      const productIds = order.items.map((i) => i.productId);
      for (let i = 0; i < productIds.length; i++) {
        for (let j = 0; j < productIds.length; j++) {
          if (i !== j) {
            const key = `${productIds[i]}_${productIds[j]}`;
            const existing = affinityMap.get(key) || {
              count: 0,
              sourceProduct: order.items.find((it) => it.productId === productIds[i])?.product,
              targetProduct: order.items.find((it) => it.productId === productIds[j])?.product,
            };
            existing.count++;
            affinityMap.set(key, existing);
          }
        }
      }
    }

    const affinities: ProductAffinity[] = [];
    const totalOrders = Math.max(orders.length, 1);

    for (const [key, data] of affinityMap) {
      const rate = (data.count / totalOrders) * 100;
      if (rate > 5 && data.sourceProduct && data.targetProduct) {
        // At least 5% co-purchase rate
        affinities.push({
          purchasedProduct: data.sourceProduct.id,
          purchasedProductName: data.sourceProduct.name,
          recommendedProduct: data.targetProduct.id,
          recommendedProductName: data.targetProduct.name,
          coOccurrenceCount: data.count,
          coOccurrenceRate: Math.round(rate * 10) / 10,
          recommendationStrength: Math.min(95, 40 + rate),
        });
      }
    }

    return affinities.sort((a, b) => b.recommendationStrength - a.recommendationStrength);
  } catch {
    return [];
  }
}

export async function getNextBestProductForCustomer(merchantId: string, customerId: string): Promise<CustomerNextBestProduct | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { orders: { include: { items: true }, orderBy: { createdAt: "desc" }, take: 5 } },
    });

    if (!customer) return null;

    // Get last purchased products
    const lastPurchasedProducts = Array.from(new Set(customer.orders.flatMap((o) => o.items.map((i) => i.productId))));

    // Get product affinities
    const affinities = await getProductAffinities(merchantId);

    // Find recommendations for purchased products
    const recommendedProductIds = new Set<string>();
    const affinityScores = new Map<string, number>();

    for (const purchased of lastPurchasedProducts) {
      const relatedAffinities = affinities.filter((a) => a.purchasedProduct === purchased);
      for (const aff of relatedAffinities) {
        if (!lastPurchasedProducts.includes(aff.recommendedProduct)) {
          recommendedProductIds.add(aff.recommendedProduct);
          const current = affinityScores.get(aff.recommendedProduct) || 0;
          affinityScores.set(aff.recommendedProduct, Math.max(current, aff.recommendationStrength));
        }
      }
    }

    // Get product details for recommendations
    const recommendedProducts = await prisma.product.findMany({
      where: { id: { in: Array.from(recommendedProductIds) } },
    });

    const nextBestProducts = recommendedProducts
      .filter((p) => p.stock > 0) // Only available products
      .map((p) => ({
        productId: p.id,
        productName: p.name,
        price: p.price / 100,
        stock: p.stock,
        affinity: affinityScores.get(p.id) || 0,
        reason: `Based on your purchase of ${lastPurchasedProducts[0] ? recommendedProducts.find((pr) => pr.id === lastPurchasedProducts[0])?.name : "similar products"}`,
      }))
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, 5);

    return {
      customerId,
      customerName: customer.name,
      lastPurchasedProducts,
      nextBestProducts,
    };
  } catch {
    return null;
  }
}

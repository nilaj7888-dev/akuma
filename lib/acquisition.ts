import { getPrisma } from "@/lib/db";

export interface AcquisitionProduct {
  productId: string;
  productName: string;
  price: number;
  firstTimeCustomerCount: number;
  totalNewCustomers: number;
  conversionRate: number;
  averageLifetimeValue: number;
  acquisitionScore: number;
}

export interface AcquisitionSegment {
  segment: string;
  newCustomerCount: number;
  averageFirstOrderValue: number;
  averageLifetimeValue: number;
  retentionRate: number;
  recommendedProducts: string[];
  acquisitionPotential: number;
}

export interface AcquisitionOpportunity {
  id: string;
  type: "PRODUCT" | "SEGMENT" | "CAMPAIGN";
  title: string;
  description: string;
  targetSegment: string;
  recommendedProduct: string;
  suggestedOffer: string;
  expectedCAC: number | null;
  expectedCLV: number;
  expectedNewCustomers: number;
  confidence: number;
  priority: number;
}

export async function getAcquisitionIntelligence(merchantId: string): Promise<{
  topAcquisitionProducts: AcquisitionProduct[];
  opportunities: AcquisitionOpportunity[];
}> {
  const prisma = getPrisma();
  if (!prisma) return { topAcquisitionProducts: [], opportunities: [] };

  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Get all customers with their first orders
    const customers = await prisma.customer.findMany({
      where: { merchantId },
      include: {
        orders: {
          where: { status: "PAID" },
          orderBy: { createdAt: "asc" },
          include: { items: { include: { product: true } } },
        },
      },
    });

    // Identify first-purchase products
    const productAcquisitionMap = new Map<string, {
      name: string;
      price: number;
      firstTimeCustomers: string[];
      lifetimeValues: number[];
    }>();

    for (const customer of customers) {
      if (customer.orders.length === 0) continue;

      const firstOrder = customer.orders[0];
      const firstProducts = firstOrder.items;

      for (const item of firstProducts) {
        const key = item.productId;
        if (!productAcquisitionMap.has(key)) {
          productAcquisitionMap.set(key, {
            name: item.product.name,
            price: item.product.price,
            firstTimeCustomers: [],
            lifetimeValues: [],
          });
        }

        const data = productAcquisitionMap.get(key)!;
        data.firstTimeCustomers.push(customer.id);
        data.lifetimeValues.push(customer.lifetimeValue);
      }
    }

    // Calculate acquisition products
    const topAcquisitionProducts: AcquisitionProduct[] = [];
    const totalNewCustomers = customers.filter(c => c.createdAt >= sixtyDaysAgo).length;

    for (const [productId, data] of productAcquisitionMap) {
      if (data.firstTimeCustomers.length >= 2) {
        const avgCLV = data.lifetimeValues.reduce((s, v) => s + v, 0) / data.lifetimeValues.length;
        const conversionRate = (data.firstTimeCustomers.length / Math.max(totalNewCustomers, 1)) * 100;

        topAcquisitionProducts.push({
          productId,
          productName: data.name,
          price: data.price / 100,
          firstTimeCustomerCount: data.firstTimeCustomers.length,
          totalNewCustomers,
          conversionRate: Math.round(conversionRate * 10) / 10,
          averageLifetimeValue: Math.round(avgCLV / 100),
          acquisitionScore: Math.round((avgCLV / 100) * conversionRate),
        });
      }
    }

    // Sort by acquisition score
    topAcquisitionProducts.sort((a, b) => b.acquisitionScore - a.acquisitionScore);

    // Generate acquisition opportunities
    const opportunities: AcquisitionOpportunity[] = [];

    // Top acquisition products
    if (topAcquisitionProducts.length > 0) {
      const topProduct = topAcquisitionProducts[0];
      opportunities.push({
        id: `acq-product-${topProduct.productId}`,
        type: "PRODUCT",
        title: `Promote ${topProduct.productName} for new customer acquisition`,
        description: `${topProduct.productName} has acquired ${topProduct.firstTimeCustomerCount} new customers with avg CLV ₹${topProduct.averageLifetimeValue}`,
        targetSegment: "New customers",
        recommendedProduct: topProduct.productName,
        suggestedOffer: "10% first-purchase discount",
        expectedCAC: null, // No campaign cost data available
        expectedCLV: topProduct.averageLifetimeValue,
        expectedNewCustomers: Math.round(topProduct.firstTimeCustomerCount * 1.5),
        confidence: 70,
        priority: topProduct.acquisitionScore,
      });
    }

    // High CLV segment opportunities
    const highCLVCustomers = customers.filter(c => c.lifetimeValue > 75000);
    if (highCLVCustomers.length > 0 && topAcquisitionProducts.length > 0) {
      const avgCLV = highCLVCustomers.reduce((s, c) => s + c.lifetimeValue, 0) / highCLVCustomers.length;
      opportunities.push({
        id: "acq-segment-high-value",
        type: "SEGMENT",
        title: "Target high-value customer lookalikes",
        description: `${highCLVCustomers.length} high-value customers (avg ₹${Math.round(avgCLV / 100)} CLV). Target similar audiences.`,
        targetSegment: "High-value lookalike",
        recommendedProduct: topAcquisitionProducts[0].productName,
        suggestedOffer: "Premium product bundle with free shipping",
        expectedCAC: null,
        expectedCLV: Math.round(avgCLV / 100),
        expectedNewCustomers: 10,
        confidence: 60,
        priority: Math.round(avgCLV / 1000),
      });
    }

    return {
      topAcquisitionProducts: topAcquisitionProducts.slice(0, 10),
      opportunities: opportunities.sort((a, b) => b.priority - a.priority),
    };
  } catch {
    return { topAcquisitionProducts: [], opportunities: [] };
  }
}

export async function getCustomerLifetimeValue(merchantId: string): Promise<Array<{
  customerId: string;
  customerName: string;
  email: string | null;
  segment: string;
  purchaseFrequency: number;
  averageOrderValue: number;
  historicalRevenue: number;
  estimatedLifetimeValue: number;
  retentionRisk: "LOW" | "MEDIUM" | "HIGH";
  nextActionPriority: number;
}>> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const customers = await prisma.customer.findMany({
      where: { merchantId },
      include: {
        orders: {
          where: { status: "PAID" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const clvData = [];

    for (const customer of customers) {
      if (customer.orders.length === 0) continue;

      const recentOrders = customer.orders.filter(o => o.createdAt >= ninetyDaysAgo);
      const avgOrderValue = customer.lifetimeValue / customer.orders.length;
      const daysSinceFirstOrder = Math.max(1, Math.round((now.getTime() - customer.orders[customer.orders.length - 1].createdAt.getTime()) / (24 * 60 * 60 * 1000)));
      const purchaseFrequency = (customer.orders.length / daysSinceFirstOrder) * 30; // Orders per month

      // Simple CLV estimate: avgOrderValue * purchaseFrequency * 12 months
      const estimatedCLV = Math.round((avgOrderValue * purchaseFrequency * 12) / 100);

      // Retention risk
      let retentionRisk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
      const daysSinceLastOrder = Math.round((now.getTime() - customer.orders[0].createdAt.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSinceLastOrder > 60) retentionRisk = "HIGH";
      else if (daysSinceLastOrder > 30) retentionRisk = "MEDIUM";

      // Determine segment
      let segment = "ACTIVE";
      if (customer.lifetimeValue > 100000) segment = "VIP";
      else if (customer.lifetimeValue > 50000) segment = "LOYAL";
      else if (daysSinceLastOrder > 60) segment = "AT_RISK";

      clvData.push({
        customerId: customer.id,
        customerName: customer.name,
        email: customer.email,
        segment,
        purchaseFrequency: Math.round(purchaseFrequency * 10) / 10,
        averageOrderValue: Math.round(avgOrderValue / 100),
        historicalRevenue: Math.round(customer.lifetimeValue / 100),
        estimatedLifetimeValue: estimatedCLV,
        retentionRisk,
        nextActionPriority: retentionRisk === "HIGH" ? 100 : retentionRisk === "MEDIUM" ? 50 : 10,
      });
    }

    return clvData.sort((a, b) => b.estimatedLifetimeValue - a.estimatedLifetimeValue);
  } catch {
    return [];
  }
}

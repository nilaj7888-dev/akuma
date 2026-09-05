import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

type ChurnAnalysis = {
  atRiskCustomers: number;
  churnRate: string;
  averageDaysSinceLastOrder: number;
  potentialRevenueLoss: number;
  topChurnReasons: Array<{ reason: string; percentage: number }>;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    // Return empty data instead of error for unauthenticated requests
    return NextResponse.json({
      atRiskCustomers: 0,
      churnRate: "0",
      averageDaysSinceLastOrder: 0,
      potentialRevenueLoss: 0,
      topChurnReasons: [],
    });
  }

  const prisma = getPrisma();
  if (!prisma) {
    // Return mock data when database is not available
    return NextResponse.json({
      atRiskCustomers: 0,
      churnRate: "0",
      averageDaysSinceLastOrder: 0,
      potentialRevenueLoss: 0,
      topChurnReasons: [],
    });
  }

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) {
      return NextResponse.json({
        atRiskCustomers: 0,
        churnRate: "0",
        averageDaysSinceLastOrder: 0,
        potentialRevenueLoss: 0,
        topChurnReasons: [],
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Get all customers with orders
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          where: { status: "PAID" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Calculate at-risk customers (no order in last 30 days)
    const atRiskCustomers = customers.filter((customer) => {
      const lastOrder = customer.orders[0];
      return !lastOrder || lastOrder.createdAt < thirtyDaysAgo;
    });

    // Calculate churn rate (customers who churned in last 30 days)
    const churnedCustomers = customers.filter((customer) => {
      const lastOrder = customer.orders[0];
      return lastOrder && lastOrder.createdAt < thirtyDaysAgo && lastOrder.createdAt >= sixtyDaysAgo;
    });

    const churnRate = customers.length > 0 ? (churnedCustomers.length / customers.length).toFixed(3) : "0";

    // Calculate average days since last order for at-risk customers
    const totalDays = atRiskCustomers.reduce((sum, customer) => {
      const lastOrder = customer.orders[0];
      if (!lastOrder) return sum + 90; // Assume 90 days if no order
      const daysSince = Math.floor((Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return sum + daysSince;
    }, 0);

    const averageDaysSinceLastOrder =
      atRiskCustomers.length > 0 ? Math.round(totalDays / atRiskCustomers.length) : 0;

    // Estimate potential revenue loss (simple calculation based on at-risk customers count)
    const potentialRevenueLoss = atRiskCustomers.length * 5000; // ₹5,000 average per customer

    // Top churn reasons (mock data for now - would need sentiment analysis of support tickets)
    const topChurnReasons = [
      { reason: "Price concerns", percentage: 35 },
      { reason: "Competitor switched", percentage: 28 },
      { reason: "Poor support experience", percentage: 18 },
      { reason: "Product dissatisfaction", percentage: 12 },
      { reason: "Other", percentage: 7 },
    ];

    const analysis: ChurnAnalysis = {
      atRiskCustomers: atRiskCustomers.length,
      churnRate,
      averageDaysSinceLastOrder,
      potentialRevenueLoss,
      topChurnReasons,
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Failed to fetch churn analysis:", error);
    return NextResponse.json({
      atRiskCustomers: 0,
      churnRate: "0",
      averageDaysSinceLastOrder: 0,
      potentialRevenueLoss: 0,
      topChurnReasons: [],
    });
  }
}

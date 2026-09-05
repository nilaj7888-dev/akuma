import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

// GET /api/merchant/analytics/forecast - revenue forecasting
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.userId)
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT")
    return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma)
    return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant)
      return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant not found." } }, { status: 404 });

    // Get revenue data for last 30 days (for daily averages)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        merchantId: merchant.id,
        status: { in: ["PAID", "PROCESSING", "COMPLETED"] as any },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { amount: true, createdAt: true },
    });

    // Calculate daily averages
    const daysOfData = Math.max(1, Math.floor((now.getTime() - thirtyDaysAgo.getTime()) / (24 * 60 * 60 * 1000)));
    const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
    const avgDailyRevenue = Math.round(totalRevenue / daysOfData);

    // Calculate weekly patterns (adjust based on day of week)
    const revenueByDay = orders.reduce((acc, order) => {
      const day = order.createdAt.getDay(); // 0 = Sunday, 6 = Saturday
      if (!acc[day]) acc[day] = { total: 0, count: 0 };
      acc[day].total += order.amount;
      acc[day].count += 1;
      return acc;
    }, {} as Record<number, { total: number; count: number }>);

    const weeklyMultiplier = Object.entries(revenueByDay).reduce((acc, [day, data]) => {
      const avg = data.count > 0 ? data.total / data.count : avgDailyRevenue;
      acc[parseInt(day)] = avg / avgDailyRevenue;
      return acc;
    }, {} as Record<number, number>);

    // Generate forecast for next 7 days
    const forecast = [];
    for (let i = 1; i <= 7; i++) {
      const forecastDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = forecastDate.getDay();
      const multiplier = weeklyMultiplier[dayOfWeek] || 1;
      const projectedRevenue = Math.round(avgDailyRevenue * multiplier);

      forecast.push({
        date: forecastDate,
        dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek],
        projectedRevenue,
        projectedRevenueDisplay: `₹${(projectedRevenue / 100).toLocaleString("en-IN")}`,
        confidence: i <= 3 ? "high" : i <= 5 ? "medium" : "low",
      });
    }

    // Projected weekly and monthly revenue
    const projectedWeek = forecast.reduce((sum, day) => sum + day.projectedRevenue, 0);
    const projectedMonth = Math.round(projectedWeek * 4.3); // Approximate weeks in month

    // Get buyer interests for demand forecasting
    const recentInterests = await prisma.buyerInterest.findMany({
      where: {
        merchantId: merchant.id,
        createdAt: { gte: thirtyDaysAgo },
      },
      include: { product: true },
    });

    const interestConversionRate = 0.2; // 20% conversion rate assumption
    const projectedFromInterests = recentInterests.length * interestConversionRate * avgDailyRevenue;

    return NextResponse.json({
      forecast: {
        days: forecast,
        week: {
          projected: projectedWeek,
          projectedDisplay: `₹${(projectedWeek / 100).toLocaleString("en-IN")}`,
        },
        month: {
          projected: projectedMonth,
          projectedDisplay: `₹${(projectedMonth / 100).toLocaleString("en-IN")}`,
        },
      },
      historical: {
        dailyAverage: avgDailyRevenue,
        dailyAverageDisplay: `₹${(avgDailyRevenue / 100).toLocaleString("en-IN")}`,
        total30Days: totalRevenue,
        total30DaysDisplay: `₹${(totalRevenue / 100).toLocaleString("en-IN")}`,
        orderCount: orders.length,
      },
      demandInsights: {
        activeInterests: recentInterests.length,
        projectedFromInterests: projectedFromInterests,
        projectedFromInterestsDisplay: `₹${(projectedFromInterests / 100).toLocaleString("en-IN")}`,
        highInterestProducts: recentInterests
          .slice(0, 5)
          .map(interest => ({
            productId: interest.productId,
            productName: interest.product?.name,
            preferredPrice: interest.preferredPrice,
          })),
      },
    });
  } catch (error) {
    console.error("Error generating forecast:", error);
    return NextResponse.json({ error: { code: "AKUMA_FETCH_ERROR", message: "Failed to generate forecast." } }, { status: 500 });
  }
}
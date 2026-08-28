import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { dashboardMetrics } from "@/lib/domain";

export async function GET() {
	if (!await getSession()) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
	const prisma = getPrisma();
	if (prisma) {
		const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
		if (!merchant) return NextResponse.json({ totalRevenue: 0, orders: 0, customers: 0, opportunities: 0, influencedRevenue: 0, actionsExecuted: 0, conversionLift: 0 });
		const [revenue, orders, customers, opportunities, campaigns, actions] = await Promise.all([
			prisma.order.aggregate({ where: { merchantId: merchant.id, status: "PAID" }, _sum: { amount: true } }),
			prisma.order.count({ where: { merchantId: merchant.id } }),
			prisma.customer.count({ where: { merchantId: merchant.id } }),
			prisma.opportunity.count({ where: { merchantId: merchant.id } }),
			prisma.campaign.aggregate({ where: { merchantId: merchant.id }, _sum: { actualRevenue: true } }),
			prisma.agentAction.count({ where: { agentRun: { merchantId: merchant.id }, status: { in: ["COMPLETED", "ACTIVE"] } } }),
		]);
		return NextResponse.json({ totalRevenue: (revenue._sum.amount ?? 0) / 100, orders, customers, opportunities, influencedRevenue: (campaigns._sum.actualRevenue ?? 0) / 100, actionsExecuted: actions, conversionLift: 0 });
	}
	return NextResponse.json(dashboardMetrics());
}

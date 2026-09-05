import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { dashboardMetrics } from "@/lib/domain";
import { resolveMerchant } from "@/lib/resolve-merchant";

const PAID_STATUSES = ["PAID", "CONFIRMED", "COMPLETED"] as const;

export async function GET() {
	const session = await getSession();
	if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
	if (session.accountType !== "MERCHANT") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant dashboard only." } }, { status: 403 });
	const prisma = getPrisma();
	if (prisma) {
		const merchant = await resolveMerchant(prisma, session);
		if (!merchant) return NextResponse.json({ totalRevenue: 0, orders: 0, customers: 0, opportunities: 0, influencedRevenue: 0, actionsExecuted: 0, conversionLift: 0, recentOrders: [] });

		const [revenue, orderCount, customers, opportunities, campaigns, recentOrders] = await Promise.all([
			prisma.order.aggregate({ where: { merchantId: merchant.id, status: { in: [...PAID_STATUSES] } }, _sum: { amount: true } }),
			prisma.order.count({ where: { merchantId: merchant.id } }),
			prisma.customer.count({ where: { merchantId: merchant.id } }),
			prisma.opportunity.count({ where: { merchantId: merchant.id } }),
			prisma.campaign.aggregate({ where: { merchantId: merchant.id }, _sum: { actualRevenue: true } }),
			prisma.order.findMany({ where: { merchantId: merchant.id }, orderBy: { createdAt: "desc" }, take: 5, include: { items: { include: { product: { select: { name: true } } } } } }),
		]);

		return NextResponse.json({
			totalRevenue: (revenue._sum.amount ?? 0) / 100,
			orders: orderCount,
			customers,
			opportunities,
			influencedRevenue: (campaigns._sum.actualRevenue ?? 0) / 100,
			actionsExecuted: 0,
			conversionLift: 0,
			recentOrders: recentOrders.map(o => ({
				id: o.id,
				status: o.status,
				amount: o.amount / 100,
				amountDisplay: `₹${(o.amount / 100).toLocaleString("en-IN")}`,
				createdAt: o.createdAt,
				itemCount: o.items.length,
				items: o.items.map(i => i.product.name).join(", "),
			})),
		});
	}
	return NextResponse.json(dashboardMetrics());
}

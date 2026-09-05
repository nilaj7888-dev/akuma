import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { analyze, getOpportunities } from "@/lib/domain";

export async function GET() {
	if (!await getSession()) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
	const prisma = getPrisma();
	if (prisma) {
		const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
		if (!merchant) return NextResponse.json([]);
		const opportunities = await prisma.opportunity.findMany({ where: { merchantId: merchant.id }, orderBy: { createdAt: "desc" } });
		return NextResponse.json(opportunities.map((opportunity) => { const evidence = opportunity.evidence as { coPurchaseRate?: number; orders?: number; customers?: number; window?: string }; return { ...opportunity, expectedRevenue: opportunity.expectedRevenue / 100, marginImpact: opportunity.marginImpact / 100, status: opportunity.status === "APPROVAL_REQUIRED" ? "AWAITING_APPROVAL" : opportunity.status === "ACTIVE" ? "ACTIVE" : opportunity.status, evidence: { coPurchaseRate: evidence.coPurchaseRate ?? 0, orders: evidence.orders ?? 0, customers: evidence.customers ?? 0, window: evidence.window ?? "14 days" }, discountPercent: 8 }; }));
	}
	return NextResponse.json(getOpportunities());
}

export async function POST() {
	if (!await getSession()) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
	const prisma = getPrisma();
	if (prisma) {
		const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
		if (!merchant) return NextResponse.json({ error: "Merchant workspace is not configured." }, { status: 404 });
		const existing = await prisma.opportunity.findFirst({ where: { merchantId: merchant.id, title: "Headphones -> Protective Case", status: { in: ["APPROVAL_REQUIRED", "ACTIVE"] } } });
		if (existing) return NextResponse.json(existing);
		const evidence = { coPurchaseRate: 31.0, orders: 1284, customers: 382, window: "14 days" };
		const result = await prisma.$transaction(async (transaction) => {
			const run = await transaction.agentRun.create({ data: { merchantId: merchant.id, trigger: "MANUAL_ANALYSIS", status: "COMPLETED", completedAt: new Date(), output: evidence } });
			const opportunity = await transaction.opportunity.create({ data: { merchantId: merchant.id, type: "CROSS_SELL", title: "Headphones -> Protective Case", description: "A compliant bundle can convert a proven post-purchase behavior into incremental revenue.", confidence: 91, expectedRevenue: 1842000, expectedLift: 6, riskScore: 18, marginImpact: -29900, status: "APPROVAL_REQUIRED", evidence } });
			await transaction.agentAction.create({ data: { agentRunId: run.id, opportunityId: opportunity.id, actionType: "CREATE_BUNDLE", input: { discountPercent: 8, productIds: ["headphones", "protective-case"] }, status: "PENDING_APPROVAL", riskLevel: "LOW" } });
			await transaction.auditLog.create({ data: { merchantId: merchant.id, actorType: "AI_AGENT", action: "Opportunity detected", resourceType: "Opportunity", resourceId: opportunity.id, reason: "31% of headphone buyers purchase a case within 14 days", output: evidence } });
			return opportunity;
		});
		return NextResponse.json({ ...result, expectedRevenue: result.expectedRevenue / 100, marginImpact: result.marginImpact / 100, status: "AWAITING_APPROVAL", evidence, discountPercent: 8 });
	}
	return NextResponse.json(analyze());
}

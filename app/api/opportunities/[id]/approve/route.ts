import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { approveOpportunity } from "@/lib/domain";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
    const { id } = await context.params;
    const prisma = getPrisma();
    if (prisma) {
      const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
      const user = merchant ? await prisma.user.findFirst({ where: { merchantId: merchant.id, role: { in: ["OWNER", "ADMIN", "OPERATOR"] } } }) : null;
      if (!merchant || !user) return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Approval permission is not configured." } }, { status: 403 });
      const opportunity = await prisma.opportunity.findFirst({ where: { id, merchantId: merchant.id } });
      if (!opportunity || opportunity.status !== "APPROVAL_REQUIRED") return NextResponse.json({ error: "Opportunity is not awaiting approval." }, { status: 409 });
      const action = await prisma.agentAction.findFirst({ where: { opportunityId: id }, orderBy: { createdAt: "desc" } });
      if (!action) return NextResponse.json({ error: "Approval action is missing." }, { status: 409 });
      const result = await prisma.$transaction(async (transaction) => {
        await transaction.opportunity.update({ where: { id }, data: { status: "ACTIVE" } });
        await transaction.agentAction.update({ where: { id: action.id }, data: { status: "COMPLETED", output: { approvedBy: user.id } } });
        await transaction.campaign.create({ data: { merchantId: merchant.id, name: "Weekend Bundle", type: "CROSS_SELL", audience: { segment: "HEADPHONE_BUYERS", size: 382 }, budget: 0, discount: 8, status: "ACTIVE", expectedRevenue: opportunity.expectedRevenue, startedAt: new Date() } });
        await transaction.auditLog.create({ data: { merchantId: merchant.id, actorType: "USER", actorId: user.id, action: "Action approved", resourceType: "Opportunity", resourceId: id, approvalResult: { status: "APPROVED" }, executionResult: { campaign: "ACTIVE" } } });
        return transaction.opportunity.findUniqueOrThrow({ where: { id } });
      });
      return NextResponse.json({ ...result, expectedRevenue: result.expectedRevenue / 100, marginImpact: result.marginImpact / 100, status: "ACTIVE", evidence: result.evidence, discountPercent: 8 });
    }
    return NextResponse.json(approveOpportunity(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approval failed" }, { status: 400 });
  }
}

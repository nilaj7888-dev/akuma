import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { approveOpportunity } from "@/lib/domain";
import { resolveMerchant } from "@/lib/resolve-merchant";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
    const { id } = await context.params;
    const prisma = getPrisma();
    if (prisma) {
      const resolved = await resolveMerchant(prisma, session);
      const merchant = resolved ? await prisma.merchant.findUnique({ where: { id: resolved.id } }) : null;
      const user = merchant ? await prisma.user.findFirst({ where: { merchantId: merchant.id, role: { in: ["OWNER", "ADMIN", "OPERATOR"] } } }) : null;
      if (!merchant || !user) return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Approval permission is not configured." } }, { status: 403 });
      const opportunity = await prisma.opportunity.findFirst({ where: { id, merchantId: merchant.id } });
      const awaitingDecision = ["DISCOVERED", "PROPOSED", "APPROVAL_REQUIRED"];
      if (!opportunity || !awaitingDecision.includes(opportunity.status)) return NextResponse.json({ error: "Opportunity is not awaiting approval." }, { status: 409 });
      const existingAction = await prisma.agentAction.findFirst({ where: { opportunityId: id }, orderBy: { createdAt: "desc" } });
      const result = await prisma.$transaction(async (transaction) => {
        await transaction.opportunity.update({ where: { id }, data: { status: "ACTIVE" } });
        if (existingAction) {
          await transaction.agentAction.update({ where: { id: existingAction.id }, data: { status: "COMPLETED", output: { approvedBy: user.id } } });
        } else {
          // Opportunities created by the AI analysis flow aren't paired with an
          // AgentAction/AgentRun yet — record one now so this approval still
          // shows up in "actions executed" and the audit trail like every
          // other approved action does.
          const run = await transaction.agentRun.create({ data: { merchantId: merchant.id, trigger: "MERCHANT_APPROVAL", status: "COMPLETED", completedAt: new Date(), output: { opportunityId: id } } });
          await transaction.agentAction.create({ data: { agentRunId: run.id, opportunityId: id, actionType: opportunity.type, input: opportunity.evidence ?? {}, output: { approvedBy: user.id }, status: "COMPLETED", riskLevel: opportunity.riskScore >= 60 ? "HIGH" : opportunity.riskScore >= 30 ? "MEDIUM" : "LOW" } });
        }
        const evidence = (opportunity.evidence ?? {}) as Record<string, unknown>;
        const audienceSize = typeof evidence.customers === "number" ? evidence.customers : typeof evidence.affected_customers === "number" ? evidence.affected_customers : null;
        await transaction.campaign.create({ data: { merchantId: merchant.id, name: opportunity.title, type: opportunity.type, audience: audienceSize != null ? { size: audienceSize } : {}, budget: 0, discount: 0, status: "ACTIVE", expectedRevenue: opportunity.expectedRevenue, startedAt: new Date() } });
        await transaction.auditLog.create({ data: { merchantId: merchant.id, actorType: "USER", actorId: user.id, action: "Action approved", resourceType: "Opportunity", resourceId: id, approvalResult: { status: "APPROVED" }, executionResult: { campaign: "ACTIVE" } } });
        return transaction.opportunity.findUniqueOrThrow({ where: { id } });
      });
      return NextResponse.json({ ...result, expectedRevenue: result.expectedRevenue / 100, marginImpact: result.marginImpact / 100, status: "ACTIVE", evidence: result.evidence });
    }
    return NextResponse.json(approveOpportunity(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approval failed" }, { status: 400 });
  }
}

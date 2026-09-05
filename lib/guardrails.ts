import { z } from "zod";

export const actionProposalSchema = z.object({
  actionType: z.enum(["CREATE_BUNDLE", "CREATE_DISCOUNT_CAMPAIGN", "CREATE_CHECKOUT_ORDER"]),
  productIds: z.array(z.string()).min(1).max(10),
  discountPercent: z.number().int().min(0).max(100),
  amount: z.number().int().nonnegative().optional(),
  budget: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(10).max(500),
});

export type ActionProposal = z.infer<typeof actionProposalSchema>;

export type MerchantPolicy = {
  maxDiscountPercent: number;
  maxCampaignBudget: number;
  maxSingleTransaction: number;
  requireApprovalAbove: number;
  minimumMarginPercent: number;
  allowedActions: string[];
};

export type GuardrailResult = {
  allowed: boolean;
  requiresApproval: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  violations: string[];
  explanation: string;
};

export function evaluateGuardrails(proposal: ActionProposal, policy: MerchantPolicy, marginPercent = 100): GuardrailResult {
  const violations: string[] = [];
  if (!policy.allowedActions.includes(proposal.actionType)) violations.push("Action type is not enabled by merchant policy.");
  if (proposal.discountPercent > policy.maxDiscountPercent) violations.push(`Discount exceeds the ${policy.maxDiscountPercent}% merchant maximum.`);
  if (proposal.budget !== undefined && proposal.budget > policy.maxCampaignBudget) violations.push("Campaign budget exceeds the merchant maximum.");
  if (proposal.amount !== undefined && proposal.amount > policy.maxSingleTransaction) violations.push("Transaction exceeds the merchant maximum.");
  if (marginPercent < policy.minimumMarginPercent) violations.push(`Margin is below the ${policy.minimumMarginPercent}% minimum.`);
  const amount = proposal.amount ?? proposal.budget ?? 0;
  const requiresApproval = amount > policy.requireApprovalAbove || proposal.actionType !== "CREATE_CHECKOUT_ORDER";
  const riskLevel = violations.length > 0 ? "CRITICAL" : amount > policy.requireApprovalAbove * 2 ? "HIGH" : requiresApproval ? "MEDIUM" : "LOW";
  return { allowed: violations.length === 0, requiresApproval, riskLevel, violations, explanation: violations.length === 0 ? "Proposal is within merchant policy." : "Proposal blocked by merchant policy." };
}

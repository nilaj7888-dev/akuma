import { describe, expect, it } from "vitest";
import { evaluateGuardrails, type MerchantPolicy } from "../lib/guardrails";

const merchantPolicy: MerchantPolicy = {
  maxDiscountPercent: 10,
  maxCampaignBudget: 500000,
  maxSingleTransaction: 1000000,
  requireApprovalAbove: 100000,
  minimumMarginPercent: 15,
  allowedActions: ["CREATE_BUNDLE", "CREATE_CHECKOUT_ORDER"],
};

describe("financial guardrails", () => {
  it("passes a compliant discount and requires approval for a campaign", () => {
    const result = evaluateGuardrails({ actionType: "CREATE_BUNDLE", productIds: ["p1", "p2"], discountPercent: 8, budget: 320000, reason: "Observed product affinity supports a bundle." }, merchantPolicy, 28);
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("blocks discounts above policy", () => {
    const result = evaluateGuardrails({ actionType: "CREATE_BUNDLE", productIds: ["p1", "p2"], discountPercent: 20, reason: "A large discount should increase conversion." }, merchantPolicy, 28);
    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.violations[0]).toContain("10%");
  });

  it("blocks actions that are not explicitly enabled", () => {
    const result = evaluateGuardrails({ actionType: "CREATE_DISCOUNT_CAMPAIGN", productIds: ["p1"], discountPercent: 5, reason: "Run a targeted campaign for qualified buyers." }, merchantPolicy);
    expect(result.allowed).toBe(false);
  });
});

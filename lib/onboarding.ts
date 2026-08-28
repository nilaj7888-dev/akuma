import { z } from "zod";

export const onboardingAnswerSchema = z.object({
  role: z.enum(["MERCHANT", "BUYER"]),
  field: z.string().min(1).max(80),
  value: z.string().trim().min(1).max(500),
  complete: z.boolean().default(false),
});

export type OnboardingContext = {
  role: "MERCHANT" | "BUYER";
  businessName?: string;
  categories?: string[];
  productCount?: number;
  catalogSource?: string;
  location?: string;
  deliveryRadius?: string;
  negotiationPreference?: string;
  primaryGoal?: string;
  buyerPriority?: string;
  conditionPreference?: string;
};

const contexts = new Map<string, OnboardingContext>();

export function getOnboarding(username: string) { return contexts.get(username) ?? null; }

export function saveOnboarding(username: string, answer: z.infer<typeof onboardingAnswerSchema>) {
  const current = contexts.get(username) ?? { role: answer.role };
  const next: OnboardingContext = { ...current, role: answer.role };
  if (answer.field === "businessName") next.businessName = answer.value;
  if (answer.field === "categories") next.categories = answer.value.split(",").map((item) => item.trim()).filter(Boolean);
  if (answer.field === "productCount") next.productCount = Number.parseInt(answer.value, 10) || 0;
  if (answer.field === "catalogSource") next.catalogSource = answer.value;
  if (answer.field === "location") next.location = answer.value;
  if (answer.field === "deliveryRadius") next.deliveryRadius = answer.value;
  if (answer.field === "negotiationPreference") next.negotiationPreference = answer.value;
  if (answer.field === "primaryGoal") next.primaryGoal = answer.value;
  if (answer.field === "buyerPriority") next.buyerPriority = answer.value;
  if (answer.field === "conditionPreference") next.conditionPreference = answer.value;
  contexts.set(username, next);
  return next;
}

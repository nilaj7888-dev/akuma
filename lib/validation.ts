import { z } from "zod";

export const checkoutRequestSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(20),
  operationId: z.string().trim().min(8).max(100),
  query: z.string().trim().max(500).default("AI buyer checkout"),
});

export const approvalRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export function parseJson<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}

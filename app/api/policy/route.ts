import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const policySchema = z.object({
  recommendationsEnabled: z.boolean().optional(),
  crossSellEnabled: z.boolean().optional(),
  upsellEnabled: z.boolean().optional(),
  conversationsEnabled: z.boolean().optional(),
  negotiationEnabled: z.boolean().optional(),
  campaignRecommendationsEnabled: z.boolean().optional(),
  autoApprovalEnabled: z.boolean().optional(),
  maxDiscountPercent: z.number().int().min(0).max(100).optional(),
  minimumMarginPercent: z.number().int().min(0).max(100).optional(),
  maxSingleTransaction: z.number().int().positive().max(100000000).optional(),
  requireApprovalAbove: z.number().int().positive().max(100000000).optional(),
});

async function getMerchant(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const prisma = getPrisma();
  const merchant = prisma ? await resolveMerchant(prisma, session) : null;
  return { prisma, merchant };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "MERCHANT") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Merchant policy only." } }, { status: 403 });
  const { prisma, merchant } = await getMerchant(session);
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required for policy settings." } }, { status: 503 });
  if (!merchant) return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant workspace is not configured." } }, { status: 404 });
  return NextResponse.json(await prisma.policy.findUnique({ where: { merchantId: merchant.id } }));
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Only an owner or admin can change policy settings." } }, { status: 403 });
  const parsed = policySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Policy settings are invalid." } }, { status: 400 });
  const { prisma, merchant } = await getMerchant(session);
  if (!prisma || !merchant) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "Merchant policy is not configured." } }, { status: 503 });
  const policy = await prisma.policy.upsert({ where: { merchantId: merchant.id }, update: parsed.data, create: { merchantId: merchant.id, allowedActions: [], ...parsed.data } });
  await prisma.auditLog.create({ data: { merchantId: merchant.id, actorType: "USER", action: "Policy changed", resourceType: "Policy", resourceId: policy.id, output: parsed.data as Prisma.InputJsonValue } });
  return NextResponse.json(policy);
}

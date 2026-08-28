import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { onboardingAnswerSchema, getOnboarding, saveOnboarding } from "@/lib/onboarding";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  const prisma = getPrisma();
  if (prisma) {
    const user = await prisma.user.findFirst({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ context: user?.onboardingComplete ? user.onboardingContext : null, accountType: user?.accountType ?? null });
  }
  return NextResponse.json({ context: getOnboarding(session.username) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  const parsed = onboardingAnswerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "That answer could not be saved." } }, { status: 400 });
  const prisma = getPrisma();
  if (prisma) {
    const user = await prisma.user.findFirst({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" } });
    if (!user) return NextResponse.json({ error: { code: "AKUMA_USER_NOT_FOUND", message: "Your AKUMA account is not provisioned." } }, { status: 404 });
    const current = (user.onboardingContext && typeof user.onboardingContext === "object" && !Array.isArray(user.onboardingContext) ? user.onboardingContext : {}) as Record<string, unknown>;
    const context = { ...current, role: parsed.data.role, [parsed.data.field]: parsed.data.field === "categories" ? parsed.data.value.split(",").map((item) => item.trim()).filter(Boolean) : parsed.data.field === "productCount" ? Number.parseInt(parsed.data.value, 10) || 0 : parsed.data.value };
    const updated = await prisma.user.update({ where: { id: user.id }, data: { accountType: parsed.data.role === "BUYER" ? "CONSUMER" : "MERCHANT", onboardingContext: JSON.parse(JSON.stringify(context)) as Prisma.InputJsonValue, onboardingComplete: parsed.data.complete } });
    return NextResponse.json({ context: updated.onboardingContext, accountType: updated.accountType });
  }
  return NextResponse.json({ context: saveOnboarding(session.username, parsed.data) });
}

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSession, createSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { onboardingAnswerSchema, getOnboarding, saveOnboarding } from "@/lib/onboarding";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

  // For demo users: return empty context - no pre-saved onboarding data
  if (session.isDemo) {
    return NextResponse.json({ context: null, accountType: session.accountType ?? null });
  }

  const prisma = getPrisma();
  if (prisma && session.userId) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    return NextResponse.json({ context: user?.onboardingComplete ? user.onboardingContext : null, accountType: user?.accountType ?? null });
  }
  return NextResponse.json({ context: getOnboarding(session.username) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

  const parsed = onboardingAnswerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "That answer could not be saved." } }, { status: 400 });

  // For demo users: onboarding is ephemeral - only save to session, not DB
  if (session.isDemo) {
    const context = { role: parsed.data.role, [parsed.data.field]: parsed.data.value };
    return NextResponse.json({ context, accountType: session.accountType ?? (parsed.data.role === "BUYER" ? "CONSUMER" : "MERCHANT") });
  }

  const prisma = getPrisma();
  if (prisma && session.userId) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: { code: "AKUMA_USER_NOT_FOUND", message: "Your AKUMA account is not provisioned." } }, { status: 404 });
    const current = (user.onboardingContext && typeof user.onboardingContext === "object" && !Array.isArray(user.onboardingContext) ? user.onboardingContext : {}) as Record<string, unknown>;

    const newAccountType = parsed.data.role === "BUYER" ? "CONSUMER" : "MERCHANT";

    // Handle email notification consent
    if (parsed.data.field === "emailNotifications") {
      const emailConsent = parsed.data.value === "Yes, email me";
      // Save to onboarding context (profile fields will be synced separately)
      (current as Record<string, unknown>)["emailNotificationsEnabled"] = emailConsent;
    }

    // Parse numeric fields
    let fieldValue: unknown = parsed.data.value;
    if (parsed.data.field === "categories") {
      fieldValue = parsed.data.value.split(",").map((item) => item.trim()).filter(Boolean);
    } else if (parsed.data.field === "productCount" || parsed.data.field === "productPrice" || parsed.data.field === "productCost" || parsed.data.field === "productStock" || parsed.data.field === "buyerBudget") {
      fieldValue = Number.parseInt(parsed.data.value, 10) || 0;
    } else {
      fieldValue = parsed.data.value;
    }

    const context = { ...current, role: parsed.data.role, [parsed.data.field]: fieldValue };
    const updated = await prisma.user.update({ where: { id: user.id }, data: { accountType: newAccountType, onboardingContext: JSON.parse(JSON.stringify(context)) as Prisma.InputJsonValue, onboardingComplete: parsed.data.complete } });

    // If onboarding is complete for a MERCHANT and they provided product details, create the product
    if (parsed.data.complete && newAccountType === "MERCHANT" && context.productName) {
      try {
        // Ensure merchant record exists
        let merchant = await prisma.merchant.findFirst({
          where: { users: { some: { id: user.id } } }
        });

        if (!merchant) {
          // Create merchant with business name from onboarding
          merchant = await prisma.merchant.create({
            data: {
              name: (context.businessName as string) || user.name || "My Store",
              email: user.email || `merchant-${user.id}@akuma.app`,
              users: { connect: { id: user.id } }
            }
          });
        }

        // Create the product from onboarding data
        const productPrice = (context.productPrice as number) || 0;
        const productCost = (context.productCost as number) || 0;
        const productStock = (context.productStock as number) || 0;
        const productCategory = (context.productCategory as string) || (context.categories as string[])?.[0] || "General";

        await prisma.product.create({
          data: {
            merchantId: merchant.id,
            name: context.productName as string,
            category: productCategory,
            sku: `${(context.productName as string)?.substring(0, 3).toUpperCase() || "PRD"}-${Date.now()}`,
            price: productPrice * 100, // Convert to paise
            cost: productCost * 100,
            stock: productStock,
            description: (context.productDescription as string) || null,
            metadata: context.productBrand ? { brand: context.productBrand } : null,
            active: true
          }
        });
      } catch (productError) {
        console.error("Failed to create product during onboarding:", productError);
        // Don't fail onboarding if product creation fails
      }
    }

    // Recreate session with updated accountType
    await createSession(session.username, session.name, session.userId, newAccountType);
    return NextResponse.json({ context: updated.onboardingContext, accountType: updated.accountType });
  }
  return NextResponse.json({ context: saveOnboarding(session.username, parsed.data) });
}

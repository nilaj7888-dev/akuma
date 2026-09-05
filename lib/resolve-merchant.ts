import type { getSession } from "@/lib/auth";
import type { getPrisma } from "@/lib/db";

const DEMO_MERCHANT_EMAIL = "demo@nova-electronics.test";

type SessionLike = NonNullable<Awaited<ReturnType<typeof getSession>>>;
type PrismaLike = NonNullable<ReturnType<typeof getPrisma>>;

/**
 * Resolve the merchant workspace for the signed-in session.
 *
 * `session.username` is NOT always an email: the email/OTP flow calls
 * createSession(user.id, ...), so it is a User id there, while the Google flow
 * puts the user's email in it. Looking a Merchant up by that value alone
 * therefore failed (404) for every OTP login. Resolve by the user's own
 * merchantId first, then by username-as-email, then fall back to the seeded
 * demo workspace.
 *
 * Every merchant-scoped route MUST share this helper: if two routes resolve
 * different merchants for the same session, data saved by one never shows up
 * for the other (this is exactly what broke merchant/location and
 * merchant/profile before they used it).
 *
 * Only `id` is selected: this repo has a history of schema/database drift, and
 * selecting whole Merchant rows makes this fail whenever a column exists in
 * schema.prisma but not yet in the database.
 */
export async function resolveMerchant(prisma: PrismaLike, session: SessionLike) {
  const userId = session.userId ?? session.username;

  // Demo sessions all share ONE stable seeded merchant (same email the demo
  // login itself uses, see lib/demo-auth.ts DEFAULT_MERCHANT) so the merchant
  // dashboard shows the same real catalog/orders customers see in the demo
  // shop, instead of a fresh empty merchant on every login.
  if (session.isDemo && session.accountType === "MERCHANT") {
    const demoEmail = (process.env.DEMO_MERCHANT_EMAIL || "demo@akuma.app").trim().toLowerCase();

    let merchant = await prisma.merchant.findUnique({
      where: { email: demoEmail },
      select: { id: true },
    });

    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: { name: session.name || "Demo Store", email: demoEmail },
        select: { id: true },
      });
    }

    return merchant;
  }

  // For real users (non-demo)
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, merchantId: true, name: true, email: true },
    });
    if (user?.merchantId) {
      const owned = await prisma.merchant.findUnique({
        where: { id: user.merchantId },
        select: { id: true },
      });
      if (owned) return owned;
    }
    // If user exists but has no merchantId, create a merchant for them
    if (user && !user.merchantId) {
      const merchant = await prisma.merchant.create({
        data: {
          name: user.name || "My Store",
          email: user.email || `merchant-${user.id}@akuma.app`,
        },
        select: { id: true },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { merchantId: merchant.id },
      });
      return merchant;
    }
  }

  if (session.username?.includes("@")) {
    const byEmail = await prisma.merchant.findUnique({
      where: { email: session.username },
      select: { id: true },
    });
    if (byEmail) return byEmail;
  }

  return prisma.merchant.findUnique({
    where: { email: DEMO_MERCHANT_EMAIL },
    select: { id: true },
  });
}

import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { clearOnboardingContexts } from "@/lib/onboarding";

// POST /api/auth/logout — invalidate the AKUMA session.
// Reuses the existing session mechanism: clearSession() deletes the httpOnly
// `akuma_session` cookie, so getSession() (and therefore every protected route
// and /api/auth/me) returns null on the next request. Works for both Merchant
// and Customer accounts, which share this one cookie.
export async function POST() {
  await clearSession();
  clearOnboardingContexts();
  return NextResponse.json({ success: true });
}

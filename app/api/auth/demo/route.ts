import { NextResponse } from "next/server";
import { demoLoginEnabled, listDemoAccounts } from "@/lib/demo-auth";

/**
 * Exposes the built-in demo credentials so the sign-in screen can offer a
 * one-tap login when email delivery is unavailable.
 *
 * This is intentionally unauthenticated: the accounts it returns are throwaway
 * demo personas, not real users. It returns an empty list whenever demo login
 * is disabled, which is the default in production (see demoLoginEnabled).
 */
export async function GET() {
  if (!demoLoginEnabled()) {
    return NextResponse.json({ enabled: false, accounts: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { enabled: true, accounts: listDemoAccounts() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

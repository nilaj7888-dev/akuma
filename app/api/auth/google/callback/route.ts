import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get("akuma_google_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) return NextResponse.json({ error: { code: "AKUMA_GOOGLE_STATE_INVALID", message: "Google sign-in could not be verified." } }, { status: 400 });
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.json({ error: { code: "AKUMA_GOOGLE_NOT_CONFIGURED", message: "Google sign-in is not configured." } }, { status: 503 });
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("Google token missing");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    if (!profileResponse.ok) throw new Error("Google profile lookup failed");
    const profile = await profileResponse.json() as { sub?: string; email?: string; name?: string; picture?: string; email_verified?: boolean };
    if (!profile.sub || !profile.email) throw new Error("Google profile is incomplete");
    const userId = `google_${profile.sub}`;
    const prisma = getPrisma();
    let accountType = "MERCHANT";
    if (prisma) {
      const user = await prisma.user.upsert({
        where: { id: userId },
        update: { email: profile.email, name: profile.name ?? profile.email, image: profile.picture, emailVerifiedAt: profile.email_verified ? new Date() : null },
        create: { id: userId, email: profile.email, name: profile.name ?? profile.email, image: profile.picture, emailVerifiedAt: profile.email_verified ? new Date() : null, accountType: "MERCHANT", role: "VIEWER" }
      });
      accountType = user.accountType;
    }
    await createSession(profile.email, profile.name ?? profile.email, userId, accountType as "MERCHANT" | "CONSUMER");
    store.delete("akuma_google_state");
    return NextResponse.redirect(`${url.origin}/`);
  } catch {
    return NextResponse.json({ error: { code: "AKUMA_GOOGLE_AUTH_FAILED", message: "Google sign-in could not be completed." } }, { status: 502 });
  }
}

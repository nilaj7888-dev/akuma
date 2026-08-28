import crypto from "node:crypto";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.json({ error: { code: "AKUMA_GOOGLE_NOT_CONFIGURED", message: "Google sign-in is not configured yet. Use the demo account or add Google OAuth credentials." } }, { status: 503 });
  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${new URL(request.url).origin}/api/auth/google/callback`;
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", access_type: "offline", state, prompt: "select_account" });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set("akuma_google_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return response;
}

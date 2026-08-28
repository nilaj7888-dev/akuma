import { NextResponse } from "next/server";
import { createSession, verifyDemoCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  if (!body.username || !body.password || !verifyDemoCredentials(body.username.trim(), body.password)) {
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Invalid demo credentials." } }, { status: 401 });
  }
  await createSession();
  return NextResponse.json({ user: { name: "Nilaj", username: "nilaj123", role: "OWNER" } });
}

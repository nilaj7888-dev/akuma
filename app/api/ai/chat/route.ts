import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAkumaAgent, runSafeFallback } from "@/ai/agents/akuma-agent";
import type { OllamaMessage } from "@/ai/llm/ollama-client";
import { ollamaHealth } from "@/ai/llm/ollama-client";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  const body = await request.json().catch(() => null) as { message?: string; role?: "MERCHANT" | "BUYER"; history?: OllamaMessage[] } | null;
  if (!body?.message?.trim()) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Message is required." } }, { status: 400 });
  const role = body.role === "BUYER" ? "BUYER" : "MERCHANT";
  const health = await ollamaHealth();
  if (!health.connected) return NextResponse.json(await runSafeFallback({ role, message: body.message.trim() }));
  try {
    return NextResponse.json(await runAkumaAgent({ username: session.username, role, message: body.message.trim(), history: body.history }));
  } catch {
    return NextResponse.json({ error: { code: "AKUMA_AI_ERROR", message: "AKUMA could not complete that request. Please try again." } }, { status: 502 });
  }
}

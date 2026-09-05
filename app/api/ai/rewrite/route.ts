import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { NEGOTIATION_TONES, MAX_REWRITE_CHARS, rewriteNegotiationText } from "@/lib/ai-negotiator";

// POST /api/ai/rewrite - Rewrite a negotiation message in a requested tone.
// Auth required: every call spends Groq tokens.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { rawInput?: string; text?: string; targetTone?: string; tone?: string; role?: string }
    | null;

  const rawInput = (body?.rawInput ?? body?.text ?? "").trim();
  if (!rawInput) {
    return NextResponse.json(
      { error: { code: "AKUMA_VALIDATION_ERROR", message: "Message text is required." } },
      { status: 400 }
    );
  }
  if (rawInput.length > MAX_REWRITE_CHARS) {
    return NextResponse.json(
      { error: { code: "AKUMA_VALIDATION_ERROR", message: `Message must be ${MAX_REWRITE_CHARS} characters or fewer.` } },
      { status: 400 }
    );
  }

  const result = await rewriteNegotiationText({
    rawInput,
    targetTone: body?.targetTone ?? body?.tone ?? "Professional",
    role: body?.role ?? (session.accountType === "MERCHANT" ? "MERCHANT" : "BUYER"),
  });

  return NextResponse.json({ success: true, availableTones: NEGOTIATION_TONES, ...result });
}

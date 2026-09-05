import { NextResponse } from "next/server";
import { sendVerificationOTP, checkRateLimit, recordAttempt, canSendOTP } from "@/lib/email";
import { getDemoAccount } from "@/lib/demo-auth";

export async function POST(request: Request) {
  try {
    const { email, accountType } = await request.json() as { email?: string; accountType?: string };

    if (!email || !accountType || (accountType !== "MERCHANT" && accountType !== "CONSUMER")) {
      return NextResponse.json({ error: "Email and account type required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Built-in demo accounts skip email delivery and rate limiting entirely —
    // their PIN is fixed, so there is nothing to send and nothing to throttle.
    const demo = getDemoAccount(email);
    if (demo) {
      return NextResponse.json({
        success: true,
        demo: true,
        pin: demo.pin,
        message: `Demo account — use PIN ${demo.pin}`,
      });
    }

    // Check rate limit
    const { allowed, retryAfter } = checkRateLimit(email);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later.", retryAfter },
        { status: 429 }
      );
    }

    // Prevent rapid concurrent requests (minimum 30 seconds between sends)
    if (!canSendOTP(email)) {
      return NextResponse.json(
        { error: "Please wait before requesting another OTP.", retryAfter: 30 },
        { status: 429 }
      );
    }

    const result = await sendVerificationOTP(email);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to send OTP" }, { status: 500 });
    }

    recordAttempt(email);
    return NextResponse.json({
      success: true,
      message: result.delivered ? "OTP sent to email" : "Email delivery unavailable — use the code shown below",
      ...(result.devCode ? { devCode: result.devCode, delivered: false } : {}),
    });
  } catch (error: unknown) {
    console.error("OTP send error:", error);
    const message = (error instanceof Error && error.message) || "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

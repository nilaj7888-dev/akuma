import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyOTP } from "@/lib/email";
import { getDemoAccount, verifyDemoPin } from "@/lib/demo-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email?: string;
      code?: string;
      name?: string;
      accountType?: string;
    };
    const { email, code } = body;

    const demo = getDemoAccount(email);

    // A demo account supplies its own name and account type, so the built-in
    // login still works when the caller only sends an email and a PIN.
    const name = body.name?.trim() || demo?.name;
    const accountType = demo?.accountType ?? body.accountType;

    if (!email || !code || !name || !accountType) {
      return NextResponse.json({ error: "Email, OTP, name, and account type required" }, { status: 400 });
    }

    if (accountType !== "MERCHANT" && accountType !== "CONSUMER") {
      return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
    }

    // Demo accounts are gated on their fixed PIN; everyone else goes through
    // the emailed OTP. This keeps sign-in usable when email delivery is broken.
    if (demo) {
      if (!verifyDemoPin(email, code)) {
        return NextResponse.json({ error: "Invalid demo PIN" }, { status: 401 });
      }
    } else {
      const result = await verifyOTP(email, code);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Invalid OTP" }, { status: 401 });
      }
    }

    const normalizedEmail = demo ? demo.email : email.trim().toLowerCase();

    // For demo accounts: create temporary in-memory session, skip DB entirely
    if (demo) {
      const tempUserId = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      // Create ephemeral session for demo users - NO database record
      await createSession(tempUserId, name, tempUserId, accountType, true);

      return NextResponse.json({
        success: true,
        demo: true,
        userId: tempUserId,
        accountType,
        onboardingComplete: false, // Demos start fresh, no pre-saved data
      });
    }

    // Real users: find or create in database
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          phoneVerified: true,
          accountType,
        },
      });
    } else {
      // Update existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true, name, accountType },
      });
    }

    // Create session with user ID as the identifier
    await createSession(user.id, name, user.id, accountType, false);

    return NextResponse.json({
      success: true,
      demo: false,
      userId: user.id,
      accountType: user.accountType,
      onboardingComplete: user.onboardingComplete,
    });
  } catch (error: any) {
    console.error("OTP verify error:", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}

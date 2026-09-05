import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Demo login removed - use email OTP authentication instead
  // Users should register via /auth/phone?role=MERCHANT or /auth/phone?role=CONSUMER
  return NextResponse.json({
    error: {
      code: "AKUMA_AUTH_DEPRECATED",
      message: "Please use email OTP authentication. Visit the homepage to register."
    }
  }, { status: 400 });
}

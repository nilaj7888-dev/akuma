import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";
import { razorpayConfigured } from "@/lib/razorpay";

export function GET() {
	const database = databaseConfigured() ? "configured" : "demo_fallback";
	const redis = process.env.REDIS_URL ? "configured" : "demo_fallback";
	const ai = process.env.AI_API_KEY ? "configured" : "deterministic_fallback";
	const razorpay = razorpayConfigured() ? "test_mode_configured" : "local_simulation";
	return NextResponse.json({ status: "operational", database, redis, ai, razorpay, webhook: process.env.RAZORPAY_WEBHOOK_SECRET ? "verification_ready" : "configuration_required" });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { getAudit } from "@/lib/domain";

export async function GET() {
	if (!await getSession()) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
	const prisma = getPrisma();
	if (prisma) {
		const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
		if (!merchant) return NextResponse.json([]);
		const events = await prisma.auditLog.findMany({ where: { merchantId: merchant.id }, orderBy: { createdAt: "desc" }, take: 50 });
		return NextResponse.json(events.map((event) => ({ id: event.id, actor: event.actorType, action: event.action, detail: event.reason ?? event.resourceType, time: event.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }), status: event.executionResult ? "SUCCESS" : event.policyResult ? "PASS" : "PENDING" })));
	}
	return NextResponse.json(getAudit());
}

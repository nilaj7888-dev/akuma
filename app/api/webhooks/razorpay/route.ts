import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";

const seenEvents = new Set<string>();

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");
  const rawBody = await request.text();
  if (!signature || !eventId || !process.env.RAZORPAY_WEBHOOK_SECRET || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: { code: "AKUMA_WEBHOOK_INVALID", message: "Webhook signature could not be verified." } }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(rawBody) as unknown; } catch { return NextResponse.json({ error: { code: "AKUMA_WEBHOOK_INVALID", message: "Webhook payload is malformed." } }, { status: 400 }); }
  const eventType = typeof payload === "object" && payload !== null && "event" in payload && typeof payload.event === "string" ? payload.event : "unknown";

  const prisma = getPrisma();
  if (prisma) {
    const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
    if (existing) return NextResponse.json({ received: true, duplicate: true });
    try {
      await prisma.webhookEvent.create({
        data: { eventId, eventType, payload: payload as object, signatureVerified: true },
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw error;
    }
  } else {
    if (seenEvents.has(eventId)) return NextResponse.json({ received: true, duplicate: true });
    seenEvents.add(eventId);
  }
  return NextResponse.json({ received: true, eventId, eventType, processed: false, mode: "queue_pending" }, { status: 202 });
}

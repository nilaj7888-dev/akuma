import crypto from "node:crypto";
import Razorpay from "razorpay";

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpay() {
  if (!razorpayConfigured()) return null;
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID as string, key_secret: process.env.RAZORPAY_KEY_SECRET as string });
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${orderId}|${paymentId}`).digest("hex");
  return timingSafeEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET ?? "").update(rawBody).digest("hex");
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function createRazorpayOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>) {
  const client = getRazorpay();
  if (!client) return null;
  return client.orders.create({ amount, currency, receipt, notes });
}

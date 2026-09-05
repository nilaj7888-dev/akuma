import Razorpay from "razorpay";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export function razorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function verifyPayment(paymentId: string, expectedAmount: number): Promise<boolean> {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment.status === "captured" && payment.amount === expectedAmount;
  } catch (error) {
    console.error("Payment verification failed:", error);
    return false;
  }
}
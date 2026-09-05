import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const isDev = process.env.NODE_ENV !== "production";

// Default sender for development
const DEFAULT_FROM = isDev ? "onboarding@resend.dev" : "noreply@akuma.com";

// In-memory mock OTP storage for development
const mockOTPs = new Map<string, { code: string; createdAt: number; verified: boolean }>();

function generateMockOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function emailConfigured(): boolean {
  // In dev mode, we can use mock OTP
  if (isDev) return true;
  return !!process.env.RESEND_API_KEY;
}

// Send OTP for email verification
export async function sendVerificationOTP(
  email: string
): Promise<{ success: boolean; error?: string; devCode?: string; delivered?: boolean }> {
  // Development: use mock OTP
  if (isDev && !process.env.RESEND_API_KEY) {
    const otp = generateMockOTP();
    mockOTPs.set(email, { code: otp, createdAt: Date.now(), verified: false });
    console.log(`[DEV] Mock OTP for ${email}: ${otp}`);
    return { success: true, devCode: otp, delivered: false };
  }

  // Production: send real email via Resend
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "Email not configured" };
  }

  const otp = generateMockOTP();
  mockOTPs.set(email, { code: otp, createdAt: Date.now(), verified: false });

  try {
    await resend.emails.send({
      from: DEFAULT_FROM,
      to: email,
      subject: "Your AKUMA Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #e9a85d; font-size: 28px;">AKUMA</h1>
            <p style="color: #666;">AI-powered commerce intelligence</p>
          </div>
          <div style="background: #f9f9f9; border-radius: 10px; padding: 30px; text-align: center;">
            <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email</h2>
            <p style="color: #666; margin-bottom: 20px;">Enter this code to complete your verification:</p>
            <div style="background: #fff; border: 2px solid #e9a85d; border-radius: 8px; padding: 20px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #e9a85d;">${otp}</span>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">This code expires in 10 minutes</p>
          </div>
          <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
            <p>If you didn't request this code, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });
    return { success: true, delivered: true };
  } catch (error) {
    console.error("Resend OTP send error:", error);
    // In development, a provider failure (unverified domain, test-mode
    // recipient restrictions, expired key) must not block sign-in. The code is
    // already stored above, so surface it instead of failing the request.
    if (isDev) {
      console.log(`[DEV] Resend failed — fallback OTP for ${email}: ${otp}`);
      return { success: true, devCode: otp, delivered: false };
    }
    return { success: false, error: "Failed to send OTP" };
  }
}

// Verify OTP
export async function verifyOTP(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  // Development: check mock OTP
  if (isDev && !process.env.RESEND_API_KEY) {
    const mockOTP = mockOTPs.get(email);
    if (!mockOTP) {
      return { success: false, error: "No OTP found for this email" };
    }
    if (mockOTP.code !== code) {
      return { success: false, error: "Invalid OTP" };
    }
    // OTP valid for 10 minutes
    if (Date.now() - mockOTP.createdAt > 600000) {
      return { success: false, error: "OTP expired" };
    }
    mockOTP.verified = true;
    mockOTPs.set(email, mockOTP);
    return { success: true };
  }

  // Production: check stored OTP
  const mockOTP = mockOTPs.get(email);
  if (!mockOTP) {
    return { success: false, error: "No OTP found for this email" };
  }
  if (mockOTP.code !== code) {
    return { success: false, error: "Invalid OTP" };
  }
  if (Date.now() - mockOTP.createdAt > 600000) {
    return { success: false, error: "OTP expired" };
  }
  mockOTP.verified = true;
  mockOTPs.set(email, mockOTP);
  return { success: true };
}

// Send offer notification email
export async function sendOfferNotification(
  to: string,
  offer: {
    id: string;
    productId: string;
    productName: string;
    buyerName: string;
    offerAmount: number;
    originalPrice: number;
    message?: string;
  }
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!process.env.RESEND_API_KEY && !isDev) {
    return { success: false, error: "Email not configured" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // Link to AKUMA dashboard - merchant responds inside the app
  const dashboardUrl = `${baseUrl}/dashboard/opportunities?offer=${offer.id}`;

  try {
    if (isDev && !process.env.RESEND_API_KEY) {
      console.log(`[DEV] Offer notification to ${to}:`, { offer, dashboardUrl });
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    const result = await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject: `New Offer for ${offer.productName} - AKUMA`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #e9a85d; font-size: 28px;">AKUMA</h1>
            <p style="color: #666;">New Buyer Offer</p>
          </div>
          <div style="background: #f9f9f9; border-radius: 10px; padding: 30px;">
            <h2 style="color: #333; margin-bottom: 20px;">${offer.buyerName} made an offer!</h2>
            <div style="background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <p style="color: #666; margin-bottom: 10px;"><strong>Product:</strong> ${offer.productName}</p>
              <p style="color: #666; margin-bottom: 10px;"><strong>Original Price:</strong> ₹${offer.originalPrice}</p>
              <p style="color: #e9a85d; font-size: 20px; font-weight: bold;"><strong>Offer Amount:</strong> ₹${offer.offerAmount}</p>
              ${offer.message ? `<p style="color: #666; margin-top: 10px;"><strong>Message:</strong> "${offer.message}"</p>` : ""}
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${dashboardUrl}" style="background: #e9a85d; color: #fff; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Review & Respond in AKUMA</a>
            </div>
          </div>
          <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
            <p>Log into your AKUMA merchant dashboard to Accept, Counter, or Reject this offer.</p>
          </div>
        </div>
      `,
    });
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Resend offer notification error:", error);
    return { success: false, error: "Failed to send notification" };
  }
}

// Send transactional email
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!process.env.RESEND_API_KEY && !isDev) {
    return { success: false, error: "Email not configured" };
  }

  try {
    if (isDev && !process.env.RESEND_API_KEY) {
      console.log(`[DEV] Email to ${to}:`, { subject, html: html.substring(0, 100) + "..." });
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    const result = await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject,
      html,
    });
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Resend email send error:", error);
    return { success: false, error: "Failed to send email" };
  }
}

// Rate limiting check (in-memory for now, use Redis in production)
// Dev settings: higher limit, shorter block for easier testing
const MAX_ATTEMPTS = isDev ? 20 : 5;
const BLOCK_DURATION_MS = isDev ? 60000 : 900000; // 1 min dev, 15 min prod
const RESET_AFTER_MS = isDev ? 300000 : 3600000; // 5 min dev, 1 hour prod

const otpAttempts = new Map<string, { count: number; firstAttempt: number; blockedUntil?: number; lastSendTime?: number }>();

export function checkRateLimit(email: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = otpAttempts.get(email);

  // Block for configured duration after max attempts
  if (record?.blockedUntil && now < record.blockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }

  // Reset after configured period
  if (record && now - record.firstAttempt > RESET_AFTER_MS) {
    otpAttempts.delete(email);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordAttempt(email: string): void {
  const now = Date.now();
  const record = otpAttempts.get(email);

  if (!record || now - record.firstAttempt > RESET_AFTER_MS) {
    otpAttempts.set(email, { count: 1, firstAttempt: now, lastSendTime: now });
  } else {
    record.count++;
    if (record.count >= MAX_ATTEMPTS) {
      record.blockedUntil = now + BLOCK_DURATION_MS;
    }
    record.lastSendTime = now;
    otpAttempts.set(email, record);
  }
}

// Check if we can send OTP (prevents rapid concurrent requests)
export function canSendOTP(email: string): boolean {
  const record = otpAttempts.get(email);
  if (!record?.lastSendTime) return true;

  // Minimum 30 seconds between OTP sends
  const now = Date.now();
  return now - record.lastSendTime > 30000;
}

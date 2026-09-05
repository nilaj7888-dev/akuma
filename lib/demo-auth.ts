import crypto from "node:crypto";

export type DemoAccountType = "MERCHANT" | "CONSUMER";

export type DemoAccount = {
  email: string;
  pin: string;
  name: string;
  accountType: DemoAccountType;
  label: string;
};

const DEFAULT_MERCHANT = {
  email: "demo@akuma.app",
  pin: "123456",
  name: "Demo Merchant",
  label: "Merchant demo",
};

const DEFAULT_CONSUMER = {
  email: "buyer@akuma.app",
  pin: "654321",
  name: "Demo Buyer",
  label: "Buyer demo",
};

/**
 * Demo logins are enabled everywhere except production, so a misconfigured or
 * rate-limited email provider can never lock you out of the app. In production
 * they stay off unless DEMO_LOGIN_ENABLED is explicitly set to "true".
 */
export function demoLoginEnabled(): boolean {
  const flag = process.env.DEMO_LOGIN_ENABLED;
  if (flag !== undefined && flag !== "") return flag.trim().toLowerCase() === "true";
  return process.env.NODE_ENV !== "production";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Every built-in demo account. Empty when demo login is disabled. */
export function listDemoAccounts(): DemoAccount[] {
  if (!demoLoginEnabled()) return [];
  return [
    {
      email: normalizeEmail(process.env.DEMO_MERCHANT_EMAIL || DEFAULT_MERCHANT.email),
      pin: (process.env.DEMO_MERCHANT_PIN || DEFAULT_MERCHANT.pin).trim(),
      name: process.env.DEMO_MERCHANT_NAME || DEFAULT_MERCHANT.name,
      accountType: "MERCHANT",
      label: DEFAULT_MERCHANT.label,
    },
    {
      email: normalizeEmail(process.env.DEMO_CONSUMER_EMAIL || DEFAULT_CONSUMER.email),
      pin: (process.env.DEMO_CONSUMER_PIN || DEFAULT_CONSUMER.pin).trim(),
      name: process.env.DEMO_CONSUMER_NAME || DEFAULT_CONSUMER.name,
      accountType: "CONSUMER",
      label: DEFAULT_CONSUMER.label,
    },
  ];
}

/** Returns the matching demo account, or null if this isn't a demo email. */
export function getDemoAccount(email: string | null | undefined): DemoAccount | null {
  if (!email) return null;
  const target = normalizeEmail(email);
  return listDemoAccounts().find((account) => account.email === target) ?? null;
}

export function isDemoAccount(email: string | null | undefined): boolean {
  return getDemoAccount(email) !== null;
}

/**
 * Constant-time PIN check. Returns false for non-demo emails, so callers can
 * use this as the single gate without pre-checking isDemoAccount().
 */
export function verifyDemoPin(email: string | null | undefined, pin: string | null | undefined): boolean {
  const account = getDemoAccount(email);
  if (!account || !pin) return false;
  const expected = Buffer.from(account.pin, "utf8");
  const received = Buffer.from(pin.trim(), "utf8");
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

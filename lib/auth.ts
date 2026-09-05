import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { AccountType } from "@prisma/client";

const sessionSecret = process.env.AUTH_SECRET || "akuma-local-development-secret";

function sign(value: string) { return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex"); }

// E.164 phone normalization
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return `+${cleaned}`;
}

export async function createSession(username: string, name: string, userId?: string, accountType: AccountType = "MERCHANT", isDemo: boolean = false) {
  const encodedName = Buffer.from(name).toString("base64url");
  const encodedUserId = userId ? Buffer.from(userId).toString("base64url") : "";
  const timestamp = Date.now();
  const value = `${username}.${timestamp}.${encodedName}.${encodedUserId}.${accountType}${isDemo ? ".demo" : ""}`;
  const store = await cookies();
  // Demo sessions expire after 15 minutes, regular sessions after 30 days
  const maxAge = isDemo ? 60 * 15 : 60 * 60 * 24 * 30;
  store.set("akuma_session", `${value}.${sign(value)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge, path: "/" });
}

export async function clearSession() { (await cookies()).delete("akuma_session"); }

export async function getSession() {
  const raw = (await cookies()).get("akuma_session")?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  // Session format: username.timestamp.encodedName.encodedUserId.accountType[.demo].signature
  // Demo sessions have 7 parts, regular have 6
  const isDemo = parts.length === 7 && parts[5] === "demo";
  if (parts.length < 6) return null;
  const [username, issuedAt, encodedName, encodedUserId, accountType, demoOrSig, signature] = parts;
  const value = isDemo
    ? `${username}.${issuedAt}.${encodedName}.${encodedUserId}.${accountType}.demo`
    : `${username}.${issuedAt}.${encodedName}.${encodedUserId}.${accountType}`;
  const expectedSignature = Buffer.from(sign(value));
  const receivedSignature = Buffer.from(isDemo ? signature : demoOrSig);
  if (!username || !issuedAt || !receivedSignature || expectedSignature.length !== receivedSignature.length || !crypto.timingSafeEqual(expectedSignature, receivedSignature)) return null;
  // Demo sessions expire after 15 minutes, regular sessions after 30 days
  const maxAge = isDemo ? 1000 * 60 * 15 : 1000 * 60 * 60 * 24 * 30;
  if (Date.now() - Number(issuedAt) > maxAge) return null;
  const name = encodedName ? Buffer.from(encodedName, "base64url").toString("utf8") : "Nilaj";
  const userId = encodedUserId ? Buffer.from(encodedUserId, "base64url").toString("utf8") : undefined;
  return { username, role: "OWNER" as const, name, userId, accountType: (accountType as AccountType) || "MERCHANT", isDemo: isDemo || undefined };
}

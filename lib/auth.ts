import crypto from "node:crypto";
import { cookies } from "next/headers";

const demoUsername = "nilaj123";
const demoDigest = "a1c231ed0b50683a1c3853f2a713aea5a42480d3fef906749d988d7bc228420f53917159d571aeff36d172497062c0b8c95c7d6fb6b52c24474fdf0a8613eb12";
const sessionSecret = process.env.AUTH_SECRET || "akuma-local-development-secret";

function digest(password: string) { return crypto.scryptSync(password, "akuma-demo-salt", 64).toString("hex"); }
function sign(value: string) { return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex"); }

export function verifyDemoCredentials(username: string, password: string) {
  const actual = Buffer.from(digest(password), "hex");
  const expected = Buffer.from(demoDigest, "hex");
  return username === demoUsername && actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function createSession(username = demoUsername, name = "Nilaj") {
  const value = `${username}.${Date.now()}.${Buffer.from(name).toString("base64url")}`;
  const store = await cookies();
  store.set("akuma_session", `${value}.${sign(value)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
}

export async function clearSession() { (await cookies()).delete("akuma_session"); }

export async function getSession() {
  const raw = (await cookies()).get("akuma_session")?.value;
  if (!raw) return null;
  const [username, issuedAt, encodedName, signature] = raw.split(".");
  const value = `${username}.${issuedAt}.${encodedName}`;
  const expectedSignature = Buffer.from(sign(value));
  const receivedSignature = Buffer.from(signature ?? "");
  if (!username || !issuedAt || !signature || expectedSignature.length !== receivedSignature.length || !crypto.timingSafeEqual(expectedSignature, receivedSignature)) return null;
  if (Date.now() - Number(issuedAt) > 1000 * 60 * 60 * 24 * 30) return null;
  const name = encodedName ? Buffer.from(encodedName, "base64url").toString("utf8") : "Nilaj";
  return { username, role: "OWNER" as const, name };
}

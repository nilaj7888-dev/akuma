import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const storeRequestSchema = z.object({ url: z.string().url().max(500) });
const blockedHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function getProducts(value: unknown) {
  const entries = Array.isArray(value) ? value : value && typeof value === "object" && "@graph" in value && Array.isArray(value["@graph"]) ? value["@graph"] : [value];
  return entries.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && (entry["@type"] === "Product" || (Array.isArray(entry["@type"]) && entry["@type"].includes("Product")))).map((entry, index) => {
    const offer = typeof entry.offers === "object" && entry.offers !== null ? entry.offers as Record<string, unknown> : {};
    const price = Number.parseFloat(String(offer.price ?? entry.price ?? ""));
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name || !Number.isFinite(price) || price < 0) return null;
    return { sku: typeof entry.sku === "string" && entry.sku.trim() ? entry.sku.trim() : `IMPORTED-${index + 1}`, name, description: typeof entry.description === "string" ? entry.description.slice(0, 2000) : null, category: typeof entry.category === "string" ? entry.category : "Imported", price: Math.round(price * 100), image: typeof entry.image === "string" ? entry.image : null };
  }).filter((product): product is NonNullable<typeof product> => Boolean(product));
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "Connect PostgreSQL before connecting a store." } }, { status: 503 });
  const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
  if (!merchant) return NextResponse.json([]);
  return NextResponse.json(await prisma.storeConnection.findMany({ where: { merchantId: merchant.id }, orderBy: { createdAt: "desc" } }));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  const parsed = storeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_INVALID_STORE_URL", message: "Enter a valid http or https store URL." } }, { status: 400 });
  const target = new URL(parsed.data.url);
  if (!/^https?:$/.test(target.protocol) || blockedHosts.has(target.hostname) || target.username || target.password) return NextResponse.json({ error: { code: "AKUMA_INVALID_STORE_URL", message: "This store URL cannot be fetched safely." } }, { status: 400 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "Connect PostgreSQL before connecting a store." } }, { status: 503 });
  const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
  if (!merchant) return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant workspace is not configured." } }, { status: 404 });
  const connection = await prisma.storeConnection.upsert({ where: { merchantId_url: { merchantId: merchant.id, url: target.toString() } }, update: { status: "SYNCING", lastError: null }, create: { merchantId: merchant.id, url: target.toString(), domain: target.hostname, status: "SYNCING" } });
  try {
    const response = await fetch(target, { headers: { accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(10000), redirect: "manual" });
    if (!response.ok || response.status >= 300 && response.status < 400) throw new Error(`Store returned HTTP ${response.status}`);
    const html = await response.text();
    const products = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => { try { return getProducts(JSON.parse(match[1])); } catch { return []; } });
    if (!products.length) throw new Error("No schema.org Product data was found on this page.");
    const imported = await prisma.$transaction(async (transaction) => {
      for (const product of products) await transaction.product.upsert({ where: { merchantId_sku: { merchantId: merchant.id, sku: product.sku } }, update: { name: product.name, description: product.description, category: product.category, price: product.price, metadata: { source: "WEBSITE", sourceUrl: target.toString(), image: product.image } }, create: { merchantId: merchant.id, sku: product.sku, name: product.name, description: product.description, category: product.category, price: product.price, cost: 0, stock: 0, active: false, metadata: { source: "WEBSITE", sourceUrl: target.toString(), image: product.image } } });
      return products.length;
    });
    const updated = await prisma.storeConnection.update({ where: { id: connection.id }, data: { status: "CONNECTED", lastSyncedAt: new Date(), lastError: null } });
    return NextResponse.json({ connection: updated, imported }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Store could not be imported.";
    const failed = await prisma.storeConnection.update({ where: { id: connection.id }, data: { status: "FAILED", lastError: message } });
    return NextResponse.json({ error: { code: "AKUMA_STORE_INGESTION_FAILED", message: "We couldn't automatically import this store.", detail: failed.lastError } }, { status: 422 });
  }
}

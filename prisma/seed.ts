import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const products = [
  ["SKU-AKU-001", "Sonic Pro Headphones", "Audio", 349900, 218000, 42],
  ["SKU-AKU-002", "Protective Case", "Audio", 49900, 18000, 116],
  ["SKU-AKU-003", "Wireless Keyboard", "Peripherals", 249900, 155000, 68],
  ["SKU-AKU-004", "Wireless Mouse", "Peripherals", 89900, 42000, 94],
  ["SKU-AKU-005", "Laptop Stand", "Workspace", 149900, 76000, 31],
  ["SKU-AKU-006", "USB-C Hub", "Workspace", 129900, 65000, 55],
] as const;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to seed PostgreSQL");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const merchant = await prisma.merchant.upsert({ where: { email: "demo@nova-electronics.test" }, update: {}, create: { name: "Nova Electronics", email: "demo@nova-electronics.test", policy: { create: { allowedActions: ["CREATE_BUNDLE", "CREATE_CHECKOUT_ORDER", "CREATE_DISCOUNT_CAMPAIGN"] } } } });
  await prisma.user.upsert({ where: { merchantId_email: { merchantId: merchant.id, email: "arjun@nova-electronics.test" } }, update: {}, create: { merchantId: merchant.id, name: "Arjun Rao", email: "arjun@nova-electronics.test", role: "OWNER" } });
  for (const [sku, name, category, price, cost, stock] of products) await prisma.product.upsert({ where: { merchantId_sku: { merchantId: merchant.id, sku } }, update: { price, cost, stock }, create: { merchantId: merchant.id, sku, name, category, price, cost, stock, description: `${name} from Nova Electronics` } });
  const productIds = await prisma.product.findMany({ where: { merchantId: merchant.id }, select: { id: true, sku: true } });
  const ids = Object.fromEntries(productIds.map((product) => [product.sku, product.id]));
  await prisma.customer.createMany({
    data: Array.from({ length: 927 }, (_, index) => ({ id: `cus_${index + 1}`, merchantId: merchant.id, name: `Nova Customer ${index + 1}`, email: `customer-${index + 1}@example.test`, segment: index < 90 ? "VIP" : index < 300 ? "LOYAL" : index < 600 ? "NEW" : index < 800 ? "AT_RISK" : "DORMANT" })),
    skipDuplicates: true,
  });
  await prisma.order.deleteMany({ where: { merchantId: merchant.id } });
  const orderData = Array.from({ length: 1284 }, (_, index) => {
    const family = index % 3;
    const familyOrder = Math.floor(index / 3);
    const productPairs = family === 0 ? [ids["SKU-AKU-001"], ...(familyOrder % 100 < 31 ? [ids["SKU-AKU-002"]] : [])] : family === 1 ? [ids["SKU-AKU-003"], ...(familyOrder % 3 !== 0 ? [ids["SKU-AKU-004"]] : [])] : [ids["SKU-AKU-005"], ...(familyOrder % 4 !== 0 ? [ids["SKU-AKU-006"]] : [])];
    const amount = productPairs.reduce((sum, productId) => sum + (products.find((product) => ids[product[0]] === productId)?.[3] ?? 0), 0);
    return { id: `ord_${index + 1}`, merchantId: merchant.id, customerId: `cus_${(index % 927) + 1}`, amount, status: "PAID" as const, source: "HISTORICAL_IMPORT", createdAt: new Date(Date.now() - (1284 - index) * 86_400_000 / 18) };
  });
  await prisma.order.createMany({ data: orderData });
  await prisma.orderItem.createMany({ data: orderData.flatMap((order, index) => {
    const family = index % 3;
    const familyOrder = Math.floor(index / 3);
    const productIds = family === 0 ? [ids["SKU-AKU-001"], ...(familyOrder % 100 < 31 ? [ids["SKU-AKU-002"]] : [])] : family === 1 ? [ids["SKU-AKU-003"], ...(familyOrder % 3 !== 0 ? [ids["SKU-AKU-004"]] : [])] : [ids["SKU-AKU-005"], ...(familyOrder % 4 !== 0 ? [ids["SKU-AKU-006"]] : [])];
    return productIds.map((productId) => { const product = products.find((item) => ids[item[0]] === productId); const unitPrice = product?.[3] ?? 0; return { orderId: order.id, productId, quantity: 1, unitPrice, total: unitPrice }; });
  }) });
  console.log(`Seeded ${merchant.name} with ${products.length} products, 927 customers, and 1,284 historical orders.`);
  await prisma.$disconnect(); await pool.end();
}

main().catch(async (error) => { console.error(error); process.exitCode = 1; });

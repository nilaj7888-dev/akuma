import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma() {
  if (!databaseConfigured()) return null;
  if (!globalForPrisma.prisma) {
    const pool = globalForPrisma.pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    globalForPrisma.pool = pool;
    globalForPrisma.prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  }
  return globalForPrisma.prisma;
}

export async function disconnectDatabase() {
  await globalForPrisma.prisma?.$disconnect();
  await globalForPrisma.pool?.end();
  globalForPrisma.prisma = undefined;
  globalForPrisma.pool = undefined;
}

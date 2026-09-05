import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { createCheckout } from "@/lib/domain";
import { checkoutRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
    const body = checkoutRequestSchema.parse(await request.json());

    const prisma = getPrisma();
    if (prisma) {
      const merchant = await prisma.merchant.findUnique({ where: { email: "demo@nova-electronics.test" } });
      if (!merchant) return NextResponse.json({ error: { code: "AKUMA_MERCHANT_NOT_FOUND", message: "Merchant workspace is not configured." } }, { status: 404 });
      const requestHash = crypto.createHash("sha256").update(JSON.stringify({ productIds: body.productIds, query: body.query })).digest("hex");
      const existing = await prisma.operation.findUnique({ where: { merchantId_operationId: { merchantId: merchant.id, operationId: body.operationId } } });
      if (existing) {
        if (existing.requestHash !== requestHash) return NextResponse.json({ error: { code: "AKUMA_OPERATION_CONFLICT", message: "Operation ID was already used for a different checkout." } }, { status: 409 });
        if (existing.response) return NextResponse.json(existing.response);
        return NextResponse.json({ error: { code: "AKUMA_OPERATION_IN_PROGRESS", message: "Checkout is already being processed." } }, { status: 202 });
      }

      const result = await prisma.$transaction(async (transaction) => {
        await transaction.operation.create({ data: { merchantId: merchant.id, operationId: body.operationId, operationType: "CHECKOUT", status: "IN_PROGRESS", requestHash } });
        const selected = await transaction.product.findMany({ where: { merchantId: merchant.id, id: { in: body.productIds }, active: true } });
        if (selected.length !== new Set(body.productIds).size || selected.some((product) => product.stock < 1)) throw new Error("Checkout does not satisfy catalog or stock constraints");
        const amount = selected.reduce((sum, product) => sum + product.price, 0);
        const order = await transaction.order.create({
          data: {
            merchantId: merchant.id,
            amount,
            source: "SHOPPING_AGENT",
            operationId: body.operationId,
            status: "PAID",
            items: { create: selected.map((product) => ({ productId: product.id, quantity: 1, unitPrice: product.price, total: product.price })) },
            transaction: { create: { merchantId: merchant.id, amount, status: "CAPTURED", verified: true } },
          },
          include: { items: { include: { product: true } } },
        });
        await transaction.product.updateMany({ where: { id: { in: selected.map((product) => product.id) }, merchantId: merchant.id }, data: { stock: { decrement: 1 } } });
        const response = { orderId: order.id, amount: amount / 100, currency: order.currency, status: "CAPTURED", products: order.items.map((item) => ({ id: item.product.id, name: item.product.name, category: item.product.category, price: item.unitPrice / 100, cost: item.product.cost / 100, stock: item.product.stock - 1 })) };
        await transaction.operation.update({ where: { merchantId_operationId: { merchantId: merchant.id, operationId: body.operationId } }, data: { status: "COMPLETED", response } });
        return response;
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(createCheckout(body.query, body.productIds, body.operationId));
  } catch (error) {
    return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: error instanceof Error ? error.message : "Checkout failed" } }, { status: 400 });
  }
}

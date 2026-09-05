import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  const orders = await prisma.order.findMany({
    where: { consumerId: session.userId },
    include: {
      items: { include: { product: true } },
      merchant: { select: { name: true } },
      transaction: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  const body = await request.json() as {
    merchantId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
  };

  const total = body.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = await prisma.order.create({
    data: {
      merchantId: body.merchantId,
      consumerId: session.userId,
      amount: total,
      source: "CONSUMER_CHECKOUT",
      status: "CREATED",
      items: {
        create: body.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(order, { status: 201 });
}

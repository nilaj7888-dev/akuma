import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const cartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});

// GET /api/consumer/cart - retrieve current shopping session/cart
export async function GET() {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer cart only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get or create shopping session
  let session_data = await prisma.shoppingSession.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  if (!session_data) {
    session_data = await prisma.shoppingSession.create({
      data: { userId: session.userId },
    });
  }

  return NextResponse.json({
    sessionId: session_data.id,
    mode: session_data.mode,
    budget: session_data.budget,
    quantity: session_data.quantity,
    requirements: session_data.requirements,
    context: session_data.context,
    createdAt: session_data.createdAt,
    updatedAt: session_data.updatedAt,
  });
}

// PATCH /api/consumer/cart - update cart/session (for now, just update mode/budget/quantity)
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer cart only." } }, { status: 403 });

  const body = await request.json().catch(() => null);
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  // Get or create shopping session
  let session_data = await prisma.shoppingSession.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  if (!session_data) {
    session_data = await prisma.shoppingSession.create({
      data: { userId: session.userId },
    });
  }

  // Update cart with provided data
  const updates: Record<string, unknown> = {};
  if (body?.mode) updates.mode = body.mode;
  if (body?.budget !== undefined) updates.budget = body.budget;
  if (body?.quantity !== undefined) updates.quantity = body.quantity;
  if (body?.requirements) updates.requirements = body.requirements;
  if (body?.context) updates.context = body.context;

  const updated = await prisma.shoppingSession.update({
    where: { id: session_data.id },
    data: updates,
  });

  return NextResponse.json({
    sessionId: updated.id,
    mode: updated.mode,
    budget: updated.budget,
    quantity: updated.quantity,
    requirements: updated.requirements,
    context: updated.context,
    updatedAt: updated.updatedAt,
  });
}

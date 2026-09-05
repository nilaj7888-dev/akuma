import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createGoal, getGoals, getGoalProgress } from "@/lib/goals";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";
import type { GoalType } from "@prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant) return NextResponse.json([]);

    const goals = await getGoals(merchant.id);
    const progress = await getGoalProgress(merchant.id);

    return NextResponse.json({
      goals,
      progress,
    });
  } catch (error) {
    console.error("Failed to fetch goals:", error);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const merchant = await resolveMerchant(prisma, session);

    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    const body = await request.json();
    const { type, name, description, targetValue, unit, startDate, endDate, priority } = body;

    if (!type || !name || !targetValue || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const goal = await createGoal(merchant.id, {
      type: type as GoalType,
      name,
      description,
      targetValue: parseInt(targetValue),
      unit,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      priority: priority ? parseInt(priority) : 0,
    });

    if (!goal) {
      return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error("Failed to create goal:", error);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}

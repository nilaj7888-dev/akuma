import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateGoal, deleteGoal } from "@/lib/goals";
import type { GoalStatus } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, targetValue, currentValue, status, priority } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (targetValue !== undefined) updates.targetValue = parseInt(targetValue);
    if (currentValue !== undefined) updates.currentValue = parseInt(currentValue);
    if (status !== undefined) updates.status = status as GoalStatus;
    if (priority !== undefined) updates.priority = parseInt(priority);

    const goal = await updateGoal(id, updates);

    if (!goal) {
      return NextResponse.json({ error: "Goal not found or update failed" }, { status: 404 });
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error("Failed to update goal:", error);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const success = await deleteGoal(id);

    if (!success) {
      return NextResponse.json({ error: "Goal not found or delete failed" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}

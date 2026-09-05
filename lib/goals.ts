import { getPrisma } from "@/lib/db";
import type { GoalType, GoalStatus, Goal } from "@prisma/client";

export interface MerchantGoal {
  id: string;
  type: GoalType;
  name: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  status: GoalStatus;
  priority: number;
  progress: number; // 0-100
  daysRemaining: number;
  onTrack: boolean;
}

export interface GoalProgress {
  goalId: string;
  currentValue: number;
  progress: number;
  onTrack: boolean;
  recommendation: string;
}

export async function createGoal(
  merchantId: string,
  input: {
    type: GoalType;
    name: string;
    description?: string;
    targetValue: number;
    unit?: string;
    startDate: Date;
    endDate: Date;
    priority?: number;
  }
): Promise<MerchantGoal | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const goal = await prisma.goal.create({
      data: {
        merchantId,
        type: input.type,
        name: input.name,
        description: input.description,
        targetValue: input.targetValue,
        unit: input.unit || "INR",
        startDate: input.startDate,
        endDate: input.endDate,
        priority: input.priority || 0,
        status: "ACTIVE",
      },
    });

    return formatGoal(goal);
  } catch (error) {
    console.error("Failed to create goal:", error);
    return null;
  }
}

export async function getGoals(
  merchantId: string,
  status?: GoalStatus
): Promise<MerchantGoal[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const goals = await prisma.goal.findMany({
      where: {
        merchantId,
        ...(status && { status }),
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return goals.map(formatGoal);
  } catch (error) {
    console.error("Failed to fetch goals:", error);
    return [];
  }
}

export async function updateGoal(
  goalId: string,
  updates: {
    name?: string;
    description?: string;
    targetValue?: number;
    currentValue?: number;
    status?: GoalStatus;
    priority?: number;
  }
): Promise<MerchantGoal | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const goal = await prisma.goal.update({
      where: { id: goalId },
      data: updates,
    });

    return formatGoal(goal);
  } catch (error) {
    console.error("Failed to update goal:", error);
    return null;
  }
}

export async function updateGoalProgress(
  goalId: string,
  currentValue: number
): Promise<MerchantGoal | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const goal = await prisma.goal.update({
      where: { id: goalId },
      data: { currentValue },
    });

    return formatGoal(goal);
  } catch (error) {
    console.error("Failed to update goal progress:", error);
    return null;
  }
}

export async function deleteGoal(goalId: string): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;

  try {
    await prisma.goal.delete({ where: { id: goalId } });
    return true;
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return false;
  }
}

export async function getGoalProgress(
  merchantId: string
): Promise<GoalProgress[]> {
  const goals = await getGoals(merchantId, "ACTIVE");
  const now = new Date();

  return goals.map((goal) => {
    const progress = Math.round(
      (goal.currentValue / goal.targetValue) * 100
    );
    const onTrack = calculateIfOnTrack(
      goal.startDate,
      goal.endDate,
      progress,
      now
    );

    let recommendation = "";
    if (progress === 0) {
      recommendation = "Get started on this goal";
    } else if (progress < 50 && !onTrack) {
      recommendation = "Accelerate progress to get back on track";
    } else if (progress < 50) {
      recommendation = "Good pace, maintain momentum";
    } else if (progress < 90 && !onTrack) {
      recommendation = "Push hard to meet the deadline";
    } else if (progress >= 90) {
      recommendation = "Excellent progress, almost there!";
    } else if (progress >= 100) {
      recommendation = "Goal achieved!";
    }

    return {
      goalId: goal.id,
      currentValue: goal.currentValue,
      progress,
      onTrack,
      recommendation,
    };
  });
}

export async function suggestGoalImprovements(
  merchantId: string
): Promise<string[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const progress = await getGoalProgress(merchantId);
    const suggestions: string[] = [];

    for (const p of progress) {
      if (p.progress < 25) {
        suggestions.push(
          `Goal "${p.goalId}" needs immediate attention - only ${p.progress}% complete`
        );
      } else if (p.progress > 100) {
        suggestions.push(`Goal "${p.goalId}" exceeded target by ${p.progress - 100}%`);
      }
    }

    return suggestions;
  } catch (error) {
    console.error("Failed to suggest goal improvements:", error);
    return [];
  }
}

// ── Internal Helpers ───────────────────────────────────────────

function formatGoal(goal: Goal): MerchantGoal {
  const now = new Date();
  const progress = Math.round((goal.currentValue / goal.targetValue) * 100);
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (goal.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    )
  );
  const onTrack = calculateIfOnTrack(
    goal.startDate,
    goal.endDate,
    progress,
    now
  );

  return {
    id: goal.id,
    type: goal.type,
    name: goal.name,
    description: goal.description,
    targetValue: goal.targetValue,
    currentValue: goal.currentValue,
    unit: goal.unit,
    startDate: goal.startDate,
    endDate: goal.endDate,
    status: goal.status,
    priority: goal.priority,
    progress,
    daysRemaining,
    onTrack,
  };
}

function calculateIfOnTrack(
  startDate: Date,
  endDate: Date,
  progress: number,
  now: Date
): boolean {
  const totalTime = endDate.getTime() - startDate.getTime();
  const elapsedTime = now.getTime() - startDate.getTime();
  const expectedProgress = (elapsedTime / totalTime) * 100;

  return progress >= expectedProgress * 0.9; // Allow 10% buffer
}

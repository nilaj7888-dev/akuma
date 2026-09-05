import { getPrisma } from "@/lib/db";
import type { ExperimentStatus } from "@prisma/client";

export interface Experiment {
  id: string;
  name: string;
  description: string | null;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  winnerId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  config: any;
  impressions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  revenuePerImpression: number;
  isWinner: boolean;
}

export interface ExperimentResult {
  experimentId: string;
  variants: ExperimentVariant[];
  winnerId: string | null;
  confidenceLevel: number;
  recommendation: string;
}

export async function createExperiment(
  merchantId: string,
  input: {
    name: string;
    description?: string;
    campaignId?: string;
    variants: Array<{ name: string; config: any }>;
  }
): Promise<Experiment | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const experiment = await prisma.experiment.create({
      data: {
        merchantId,
        campaignId: input.campaignId,
        name: input.name,
        description: input.description,
        status: "DRAFT",
        variants: {
          create: input.variants.map((v) => ({
            name: v.name,
            config: v.config,
          })),
        },
      },
      include: { variants: true },
    });

    return formatExperiment(experiment);
  } catch (error) {
    console.error("Failed to create experiment:", error);
    return null;
  }
}

export async function getExperiments(
  merchantId: string,
  status?: ExperimentStatus
): Promise<Experiment[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const experiments = await prisma.experiment.findMany({
      where: {
        merchantId,
        ...(status && { status }),
      },
      include: { variants: true },
      orderBy: { createdAt: "desc" },
    });

    return experiments.map(formatExperiment);
  } catch (error) {
    console.error("Failed to fetch experiments:", error);
    return [];
  }
}

export async function updateExperimentStatus(
  experimentId: string,
  status: ExperimentStatus
): Promise<Experiment | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const experiment = await prisma.experiment.update({
      where: { id: experimentId },
      data: {
        status,
        ...(status === "RUNNING" && { startedAt: new Date() }),
        ...(status === "COMPLETED" && { completedAt: new Date() }),
      },
      include: { variants: true },
    });

    return formatExperiment(experiment);
  } catch (error) {
    console.error("Failed to update experiment status:", error);
    return null;
  }
}

export async function recordVariantImpression(
  variantId: string
): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;

  try {
    await prisma.experimentVariant.update({
      where: { id: variantId },
      data: { impressions: { increment: 1 } },
    });
    return true;
  } catch (error) {
    console.error("Failed to record impression:", error);
    return false;
  }
}

export async function recordVariantConversion(
  variantId: string,
  revenue: number
): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;

  try {
    await prisma.experimentVariant.update({
      where: { id: variantId },
      data: {
        conversions: { increment: 1 },
        revenue: { increment: revenue },
      },
    });
    return true;
  } catch (error) {
    console.error("Failed to record conversion:", error);
    return false;
  }
}

export async function analyzeExperiment(
  experimentId: string
): Promise<ExperimentResult | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      include: { variants: true },
    });

    if (!experiment) return null;

    const variants = experiment.variants.map(formatVariant);

    // Calculate statistical significance (simplified Chi-Square test)
    const totalImpressions = variants.reduce((sum, v) => sum + v.impressions, 0);
    const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);

    if (totalImpressions < 100) {
      return {
        experimentId,
        variants,
        winnerId: null,
        confidenceLevel: 0,
        recommendation: "Not enough data yet. Continue running the experiment.",
      };
    }

    // Find variant with highest conversion rate
    const sortedByConversion = [...variants].sort(
      (a, b) => b.conversionRate - a.conversionRate
    );
    const winner = sortedByConversion[0];

    // Simple confidence calculation (need at least 2x difference and 50+ conversions)
    const secondBest = sortedByConversion[1];
    const confidenceLevel = calculateConfidence(winner, secondBest);

    let recommendation = "";
    if (confidenceLevel > 95) {
      recommendation = `Variant ${winner.name} is the clear winner with ${confidenceLevel}% confidence. Deploy it to all users.`;
    } else if (confidenceLevel > 80) {
      recommendation = `Variant ${winner.name} is leading but needs more data to confirm. Continue the experiment.`;
    } else {
      recommendation = "No clear winner yet. Variants are performing similarly. Consider running longer or trying different approaches.";
    }

    // Update experiment with winner if high confidence
    if (confidenceLevel > 95) {
      await prisma.experiment.update({
        where: { id: experimentId },
        data: { winnerId: winner.id },
      });
    }

    return {
      experimentId,
      variants,
      winnerId: confidenceLevel > 95 ? winner.id : null,
      confidenceLevel,
      recommendation,
    };
  } catch (error) {
    console.error("Failed to analyze experiment:", error);
    return null;
  }
}

// ── Internal Helpers ───────────────────────────────────────────

function formatExperiment(experiment: any): Experiment {
  return {
    id: experiment.id,
    name: experiment.name,
    description: experiment.description,
    status: experiment.status,
    variants: experiment.variants.map(formatVariant),
    winnerId: experiment.winnerId,
    startedAt: experiment.startedAt,
    completedAt: experiment.completedAt,
    createdAt: experiment.createdAt,
  };
}

function formatVariant(variant: any): ExperimentVariant {
  const conversionRate =
    variant.impressions > 0
      ? (variant.conversions / variant.impressions) * 100
      : 0;
  const revenuePerImpression =
    variant.impressions > 0 ? variant.revenue / variant.impressions : 0;

  return {
    id: variant.id,
    name: variant.name,
    config: variant.config,
    impressions: variant.impressions,
    conversions: variant.conversions,
    revenue: variant.revenue,
    conversionRate: Math.round(conversionRate * 100) / 100,
    revenuePerImpression: Math.round(revenuePerImpression),
    isWinner: false,
  };
}

function calculateConfidence(
  winner: ExperimentVariant,
  secondBest: ExperimentVariant
): number {
  if (!winner || !secondBest) return 0;
  if (winner.impressions < 50 || secondBest.impressions < 50) return 0;

  const diffRate = winner.conversionRate - secondBest.conversionRate;
  const relativeDiff = (diffRate / secondBest.conversionRate) * 100;

  // Simplified confidence: based on relative difference and sample size
  let confidence = 0;
  if (relativeDiff > 50 && winner.impressions > 100) confidence = 99;
  else if (relativeDiff > 30 && winner.impressions > 100) confidence = 95;
  else if (relativeDiff > 20 && winner.impressions > 50) confidence = 85;
  else if (relativeDiff > 10) confidence = 70;
  else confidence = 50;

  return Math.min(confidence, 99);
}

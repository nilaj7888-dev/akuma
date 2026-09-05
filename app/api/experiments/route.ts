import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createExperiment, getExperiments, updateExperimentStatus, analyzeExperiment } from "@/lib/ab-testing";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json([]);

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const experimentId = searchParams.get("id");

    if (action === "analyze" && experimentId) {
      const result = await analyzeExperiment(experimentId);
      return NextResponse.json(result);
    }

    const experiments = await getExperiments(merchant.id);
    return NextResponse.json(experiments);
  } catch (error) {
    console.error("Failed to fetch experiments:", error);
    return NextResponse.json({ error: "Failed to fetch experiments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    const body = await request.json();
    const { name, description, campaignId, variants } = body;

    if (!name || !variants || variants.length < 2) {
      return NextResponse.json({ error: "Experiment needs a name and at least 2 variants" }, { status: 400 });
    }

    const experiment = await createExperiment(merchant.id, {
      name,
      description,
      campaignId,
      variants,
    });

    if (!experiment) {
      return NextResponse.json({ error: "Failed to create experiment" }, { status: 500 });
    }

    return NextResponse.json(experiment);
  } catch (error) {
    console.error("Failed to create experiment:", error);
    return NextResponse.json({ error: "Failed to create experiment" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { experimentId, status } = body;

    if (!experimentId || !status) {
      return NextResponse.json({ error: "Missing experimentId or status" }, { status: 400 });
    }

    const experiment = await updateExperimentStatus(experimentId, status);

    if (!experiment) {
      return NextResponse.json({ error: "Failed to update experiment" }, { status: 500 });
    }

    return NextResponse.json(experiment);
  } catch (error) {
    console.error("Failed to update experiment:", error);
    return NextResponse.json({ error: "Failed to update experiment" }, { status: 500 });
  }
}

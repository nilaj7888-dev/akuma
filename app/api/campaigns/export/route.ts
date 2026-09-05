import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { apiError } from "@/lib/api-response";

export async function GET() {
  const session = await getSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in required.", 401);

  const prisma = getPrisma();
  if (!prisma) return apiError("DATABASE_UNAVAILABLE", "Database connection required.", 503);

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: "demo@nova-electronics.test" },
    });

    if (!merchant) return apiError("NOT_FOUND", "Merchant not found.", 404);

    const campaigns = await prisma.campaign.findMany({
      where: { merchantId: merchant.id },
      orderBy: { id: "desc" },
    });

    // Generate CSV
    const headers = [
      "ID",
      "Name",
      "Type",
      "Status",
      "Budget (INR)",
      "Discount (%)",
      "Expected Revenue (INR)",
      "Actual Revenue (INR)",
      "Started At",
      "Ended At",
    ];

    const rows = campaigns.map((c) => [
      c.id,
      c.name,
      c.type,
      c.status,
      (c.budget / 100).toFixed(2),
      c.discount,
      (c.expectedRevenue / 100).toFixed(2),
      (c.actualRevenue / 100).toFixed(2),
      c.startedAt ? c.startedAt.toISOString() : "",
      c.endedAt ? c.endedAt.toISOString() : "",
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="campaigns-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return apiError("INTERNAL_ERROR", "Export failed.", 500);
  }
}

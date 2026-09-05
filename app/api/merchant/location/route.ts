import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { resolveMerchant } from "@/lib/resolve-merchant";

// Google Places autocomplete (New)
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) return NextResponse.json({ predictions: [] });

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleApiKey) return NextResponse.json({ error: "Google API not configured" }, { status: 500 });

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleApiKey },
      body: JSON.stringify({ input: query, includedRegionCodes: ["in"] }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json() as {
      suggestions?: Array<{ placePrediction?: { placeId: string; text: { text: string } } }>;
    };
    const predictions = (data.suggestions || [])
      .filter((s) => s.placePrediction)
      .map((s) => ({ place_id: s.placePrediction!.placeId, description: s.placePrediction!.text.text }));
    return NextResponse.json({ predictions });
  } catch {
    return NextResponse.json({ error: "Failed to fetch predictions" }, { status: 500 });
  }
}

function findComponent(components: Array<{ longText: string; types: string[] }>, type: string): string | undefined {
  return components.find((c) => c.types.includes(type))?.longText;
}

// Get place details (coordinates, etc.) and save to the merchant
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { placeId } = await request.json() as { placeId: string };

  if (!placeId) return NextResponse.json({ error: "Place ID required" }, { status: 400 });

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleApiKey) return NextResponse.json({ error: "Google API not configured" }, { status: 500 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  try {
    const merchant = await resolveMerchant(prisma, session);
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    // Fetch place details from Google (New Places API)
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: { "X-Goog-Api-Key": googleApiKey, "X-Goog-FieldMask": "formattedAddress,location,addressComponents" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return NextResponse.json({ error: "Place details not found" }, { status: 404 });
    const result = await response.json() as {
      formattedAddress: string;
      location: { latitude: number; longitude: number };
      addressComponents: Array<{ longText: string; types: string[] }>;
    };

    const city = findComponent(result.addressComponents, "locality") || findComponent(result.addressComponents, "administrative_area_level_3") || "";
    const state = findComponent(result.addressComponents, "administrative_area_level_1") || "";

    // Save to merchant
    const updated = await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        location: result.formattedAddress,
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        placeId,
      },
    });

    return NextResponse.json({ location: updated.location, latitude: updated.latitude, longitude: updated.longitude, city, state });
  } catch {
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}

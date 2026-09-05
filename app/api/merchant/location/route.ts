import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// Google Places autocomplete
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const sessionToken = searchParams.get("sessionToken");

  if (!query || query.length < 2) return NextResponse.json({ predictions: [] });

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleApiKey) return NextResponse.json({ error: "Google API not configured" }, { status: 500 });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${googleApiKey}&sessiontoken=${sessionToken || ""}&components=country:in`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json() as { predictions: Array<{ place_id: string; description: string; main_text: string }> };
    return NextResponse.json({ predictions: data.predictions || [] });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch predictions" }, { status: 500 });
  }
}

// Get place details (coordinates, etc.)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { placeId, sessionToken } = await request.json() as { placeId: string; sessionToken: string };

  if (!placeId) return NextResponse.json({ error: "Place ID required" }, { status: 400 });

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleApiKey) return NextResponse.json({ error: "Google API not configured" }, { status: 500 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 503 });

  try {
    // Find merchant by userId
    const user = await prisma.user.findUnique({ where: { id: session.userId || "" } });
    const merchant = user ? await prisma.merchant.findUnique({ where: { id: user.merchantId || "" } }) : null;
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    // Fetch place details from Google
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,name&key=${googleApiKey}&sessiontoken=${sessionToken || ""}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json() as {
      result?: {
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        name: string;
      };
    };

    if (!data.result) return NextResponse.json({ error: "Place details not found" }, { status: 404 });

    const result = data.result;

    // Save to merchant
    const updated = await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        location: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId,
      },
    });

    return NextResponse.json({ location: updated.location, latitude: updated.latitude, longitude: updated.longitude });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}

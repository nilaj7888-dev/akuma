import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/consumer/addresses/autocomplete?q=... - Google Places autocomplete (New) for delivery address entry
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) return NextResponse.json({ predictions: [] });

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleApiKey) return NextResponse.json({ error: { code: "AKUMA_MAPS_NOT_CONFIGURED", message: "Google API not configured." } }, { status: 503 });

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
    return NextResponse.json({ error: { code: "AKUMA_PLACES_ERROR", message: "Failed to fetch predictions." } }, { status: 500 });
  }
}

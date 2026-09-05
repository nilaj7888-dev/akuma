import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/consumer/addresses/autocomplete?q=... - Google Places autocomplete for delivery address entry
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const sessionToken = searchParams.get("sessionToken");

  if (!query || query.length < 2) return NextResponse.json({ predictions: [] });

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleApiKey) return NextResponse.json({ error: { code: "AKUMA_MAPS_NOT_CONFIGURED", message: "Google API not configured." } }, { status: 503 });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${googleApiKey}&sessiontoken=${sessionToken || ""}&components=country:in`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json() as { predictions: Array<{ place_id: string; description: string }> };
    return NextResponse.json({ predictions: data.predictions || [] });
  } catch {
    return NextResponse.json({ error: { code: "AKUMA_PLACES_ERROR", message: "Failed to fetch predictions." } }, { status: 500 });
  }
}

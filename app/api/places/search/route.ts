import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Places API not configured" }, { status: 503 });

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
      body: JSON.stringify({ textQuery: query, maxResultCount: 10 }),
    });

    if (!response.ok) throw new Error("Places API error");
    const data = await response.json() as { places?: Array<{ displayName: { text: string }; formattedAddress: string; location: { latitude: number; longitude: number }; googleMapsUri: string; name?: string }> };

    return NextResponse.json({
      results: (data.places ?? []).map((p) => ({
        id: p.name,
        name: p.displayName.text,
        address: p.formattedAddress,
        lat: p.location.latitude,
        lng: p.location.longitude,
        url: p.googleMapsUri,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to search places" }, { status: 500 });
  }
}

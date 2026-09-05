import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

// GET /api/consumer/addresses - list the signed-in consumer's saved delivery addresses
export async function GET() {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const profile = await prisma.consumerProfile.findUnique({ where: { userId: session.userId } });
  if (!profile) return NextResponse.json({ addresses: [] });

  const addresses = await prisma.deliveryAddress.findMany({
    where: { profileId: profile.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ addresses });
}

const geocodedAddressSchema = z.object({
  placeId: z.string(),
  sessionToken: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().min(1),
  addressLine2: z.string().optional(),
  contactConsent: z.boolean().optional(),
});

// Manual fallback — used when Google Places isn't available/configured. No
// coordinates are stored, so this order won't get a delivery-cost estimate.
const manualAddressSchema = z.object({
  manual: z.literal(true),
  name: z.string().min(1),
  phone: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().optional(),
  contactConsent: z.boolean().optional(),
});

function findComponent(components: Array<{ long_name: string; short_name: string; types: string[] }>, type: string): string | undefined {
  return components.find((c) => c.types.includes(type))?.long_name;
}

// POST /api/consumer/addresses - save a delivery address, either geocoded via a Google Place ID
// or entered manually (no coordinates, no delivery-cost estimate later).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) return NextResponse.json({ error: { code: "AKUMA_UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });
  if (session.accountType !== "CONSUMER") return NextResponse.json({ error: { code: "AKUMA_FORBIDDEN", message: "Consumer only." } }, { status: 403 });

  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: { code: "AKUMA_DATABASE_REQUIRED", message: "PostgreSQL is required." } }, { status: 503 });

  const body = await request.json().catch(() => null);

  const manualParsed = manualAddressSchema.safeParse(body);
  if (manualParsed.success) {
    let profile = await prisma.consumerProfile.findUnique({ where: { userId: session.userId } });
    if (!profile) profile = await prisma.consumerProfile.create({ data: { userId: session.userId } });
    const existingCount = await prisma.deliveryAddress.count({ where: { profileId: profile.id } });

    const address = await prisma.deliveryAddress.upsert({
      where: { profileId_addressLine1_postalCode: { profileId: profile.id, addressLine1: manualParsed.data.addressLine1, postalCode: manualParsed.data.postalCode } },
      update: {
        name: manualParsed.data.name,
        phone: manualParsed.data.phone,
        addressLine2: manualParsed.data.addressLine2,
        city: manualParsed.data.city,
        state: manualParsed.data.state,
        country: manualParsed.data.country || "India",
        contactConsent: manualParsed.data.contactConsent ?? false,
      },
      create: {
        profileId: profile.id,
        name: manualParsed.data.name,
        phone: manualParsed.data.phone,
        addressLine1: manualParsed.data.addressLine1,
        addressLine2: manualParsed.data.addressLine2,
        city: manualParsed.data.city,
        state: manualParsed.data.state,
        postalCode: manualParsed.data.postalCode,
        country: manualParsed.data.country || "India",
        isDefault: existingCount === 0,
        contactConsent: manualParsed.data.contactConsent ?? false,
      },
    });

    return NextResponse.json({ address });
  }

  const parsed = geocodedAddressSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "AKUMA_VALIDATION_ERROR", message: "Invalid address data." } }, { status: 400 });

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleApiKey) return NextResponse.json({ error: { code: "AKUMA_MAPS_NOT_CONFIGURED", message: "Google API not configured." } }, { status: 503 });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${parsed.data.placeId}&fields=formatted_address,geometry,address_component&key=${googleApiKey}&sessiontoken=${parsed.data.sessionToken || ""}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json() as {
      result?: {
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
      };
    };

    if (!data.result) return NextResponse.json({ error: { code: "AKUMA_PLACE_NOT_FOUND", message: "Couldn't look up that address. You can enter it manually instead." } }, { status: 404 });

    const { result } = data;
    const components = result.address_components || [];
    const streetNumber = findComponent(components, "street_number");
    const route = findComponent(components, "route");
    const addressLine1 = [streetNumber, route].filter(Boolean).join(" ") || result.formatted_address.split(",")[0];
    const city = findComponent(components, "locality") || findComponent(components, "administrative_area_level_2") || "";
    const state = findComponent(components, "administrative_area_level_1") || "";
    const postalCode = findComponent(components, "postal_code") || "";
    const country = findComponent(components, "country") || "India";

    let profile = await prisma.consumerProfile.findUnique({ where: { userId: session.userId } });
    if (!profile) profile = await prisma.consumerProfile.create({ data: { userId: session.userId } });

    const existingCount = await prisma.deliveryAddress.count({ where: { profileId: profile.id } });

    const address = await prisma.deliveryAddress.upsert({
      where: { profileId_addressLine1_postalCode: { profileId: profile.id, addressLine1, postalCode } },
      update: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        addressLine2: parsed.data.addressLine2,
        city,
        state,
        country,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId: parsed.data.placeId,
        contactConsent: parsed.data.contactConsent ?? false,
      },
      create: {
        profileId: profile.id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        addressLine1,
        addressLine2: parsed.data.addressLine2,
        city,
        state,
        postalCode,
        country,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId: parsed.data.placeId,
        isDefault: existingCount === 0,
        contactConsent: parsed.data.contactConsent ?? false,
      },
    });

    return NextResponse.json({ address });
  } catch (error) {
    console.error("Failed to save delivery address:", error);
    return NextResponse.json({ error: { code: "AKUMA_ADDRESS_ERROR", message: "Failed to save address." } }, { status: 500 });
  }
}

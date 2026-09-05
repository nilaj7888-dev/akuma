// Haversine distance and a simple, transparent delivery-cost estimate.
// Used by buyer-demand matching (in/out-of-range check) and by the
// merchant-facing "estimated delivery cost" shown on paid orders.

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const BASE_FEE_PAISE = 4000; // ₹40 base handling/pickup fee
const PER_KM_PAISE = 800; // ₹8/km

// A simple, transparent estimate — not a real courier-rate lookup.
// Merchants should treat this as a planning figure, not a quote.
export function estimateDeliveryCostPaise(distanceKm: number): number {
  return Math.round(BASE_FEE_PAISE + Math.max(0, distanceKm) * PER_KM_PAISE);
}

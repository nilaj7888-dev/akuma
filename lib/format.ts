// Real, deterministic display formatters shared across the dashboard.
// (Previously named lib/mock-data.ts — this file used to also contain
// Math.random()-based fake data generators for pages with no backing API.
// Those were unused dead code and have been removed; every dashboard page
// now sources its numbers from a real API route. Keep this file limited to
// pure, deterministic formatting helpers — never business data.)

export const formatMoney = (value?: number | null) => `₹${(value ?? 0).toLocaleString("en-IN")}`;

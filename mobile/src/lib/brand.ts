/**
 * Brand constants. Every user-facing name comes from here, so renaming the app
 * is one edit rather than a search across screens.
 *
 * Internal identifiers — Mongo collections, storage keys already in the field,
 * API paths — are deliberately NOT derived from these values.
 */
export const BRAND = {
  /** The wordmark. Used alone wherever the city is already obvious. */
  name: "OnlineMall",
  /** The full lockup, for first-run surfaces and anywhere trust is being built. */
  fullName: "OnlineMall (Hindaun)",
  city: "Hindaun City",
  region: "Rajasthan",
  /** The promise, in the user's words rather than ours. */
  tagline: "Hindaun ka apna store, minutes mein.",
  taglineEn: "Your whole city, delivered in minutes.",
  searchPlaceholder: "Search for atta, milk, snacks\u2026",
  supportEmail: "help@onlinemall.in",
} as const;

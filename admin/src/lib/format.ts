/**
 * Money arrives from the API in minor units (PAISE), matching the mobile app.
 *
 * Indian digit grouping is not the Western one: the last three digits group
 * together, then every two after that (12,34,567 — not 1,234,567). Done by hand
 * rather than through `toLocaleString`, so the backoffice and the app can never
 * disagree about what a number looks like — this is the same implementation as
 * mobile/src/lib/format.ts.
 */
const groupIndian = (whole: string): string => {
  if (whole.length <= 3) return whole;

  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);

  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
};

/**
 * Two decimals always. Unlike the storefront, a backoffice column is read by
 * someone reconciling figures, and ₹45 above ₹45.50 does not line up.
 */
export const formatMoney = (paise: number): string => {
  const negative = paise < 0;
  const absolute = Math.abs(Math.round(paise));

  return `${negative ? "-" : ""}\u20B9${groupIndian(String(Math.floor(absolute / 100)))}.${String(
    absolute % 100,
  ).padStart(2, "0")}`;
};

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** "2 min", "6 min", "3 h" — how long ago an event happened. */
export const formatAgo = (iso: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));

  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;

  return `${Math.round(minutes / 1440)} d`;
};

/** Percentage change against a previous period; null when there is no baseline. */
export const percentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null;

  return ((current - previous) / previous) * 100;
};

/** Split for stacked cells: the date on one line, the clock time under it. */
export const formatDateTime = (iso: string): { date: string; time: string } => {
  const at = new Date(iso);

  return {
    date: at.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }),
    time: at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
};

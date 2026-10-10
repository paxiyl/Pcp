/**
 * Money arrives from the API in minor units (paise) so nothing is ever a float.
 * Orders are charged in INR.
 *
 * Indian digit grouping is not the Western one: the last three digits group
 * together, then every two after that (12,34,567 — not 1,234,567). Hermes ships
 * a trimmed ICU on some Android builds, so this is done by hand rather than
 * through Intl, which would silently fall back to Western grouping.
 */

const RUPEE = "\u20B9";

/** 1234567 -> "12,34,567" */
const groupIndian = (whole: string): string => {
  if (whole.length <= 3) return whole;

  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);

  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
};

/**
 * Prices are shown without paise when the amount is whole, which is how every
 * Indian storefront prices a product. A ₹45 pack of atta should not read ₹45.00.
 */
export const formatPrice = (paise: number): string => {
  const negative = paise < 0;
  const absolute = Math.abs(Math.round(paise));
  const rupees = Math.floor(absolute / 100);
  const remainder = absolute % 100;

  const body =
    remainder === 0
      ? groupIndian(String(rupees))
      : `${groupIndian(String(rupees))}.${String(remainder).padStart(2, "0")}`;

  return `${negative ? "-" : ""}${RUPEE}${body}`;
};

/** Always two decimals. For invoices and the checkout breakdown, where columns align. */
export const formatPriceExact = (paise: number): string => {
  const negative = paise < 0;
  const absolute = Math.abs(Math.round(paise));

  return `${negative ? "-" : ""}${RUPEE}${groupIndian(String(Math.floor(absolute / 100)))}.${String(
    absolute % 100,
  ).padStart(2, "0")}`;
};

export const formatDeliveryFee = (paise: number): string =>
  paise === 0 ? "Free delivery" : `${formatPrice(paise)} delivery`;

export const formatPrepTime = (min: number, max: number): string => `${min}\u2013${max} min`;

/** Quick-commerce ETA: a single number, not a range, because speed is the promise. */
export const formatEta = (minutes: number): string => `${Math.max(1, Math.round(minutes))} min`;

/** "₹120 off" / "20% off" — the badge copy, derived so it can never disagree with the price. */
export const formatDiscount = (mrpPaise: number, pricePaise: number): string | null => {
  if (mrpPaise <= pricePaise) return null;

  const percent = Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);

  return percent >= 5 ? `${percent}% OFF` : `${formatPrice(mrpPaise - pricePaise)} OFF`;
};

export const formatSavings = (mrpPaise: number, pricePaise: number): string | null =>
  mrpPaise > pricePaise ? `You save ${formatPrice(mrpPaise - pricePaise)}` : null;

/** "22:30" -> "10:30 PM" */
export const formatClosingTime = (value: string): string => {
  const [hours, minutes] = value.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

/**
 * What a shopkeeper typed, in paise.
 *
 * The inverse of `formatPrice`, and the only place a rupee figure becomes a
 * stored amount. It is separated out and checked
 * (`api/src/scripts/checks/money.check.mjs`) because the failure mode is not a
 * crash: read "120" as 120 instead of 12000 and a shop sells atta for ₹1.20
 * until somebody notices, and `Number("120.5") * 100` is 12050.000000000002
 * before rounding, which is how a float reaches a field that is documented as
 * an integer.
 *
 * Returns null for anything that is not a plain positive amount, so the caller
 * shows a field error rather than storing a guess. More than two decimal places
 * is a typo, not a price: no Indian shop charges in fractions of a paisa.
 */
export const parseRupees = (value: string): number | null => {
  const text = value.trim().replace(/[\s,₹]/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;

  return Math.round(Number(text) * 100);
};

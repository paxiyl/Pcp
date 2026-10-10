import type { BasketPaymentOptions, PaymentMethod, PaymentPreferences } from "@/lib/api";

/**
 * What this build can actually open, and what follows from it.
 *
 * Deliberately free of value imports — the sheet module pulls in Stripe's
 * native binding, and this file is run directly by
 * `api/src/scripts/checks/payment-availability.check.mjs`. The decision about
 * whether somebody can pay is not a thing to leave untested on the one screen
 * where being wrong costs an order.
 */

/**
 * Stripe is a dependency of this app, so a Stripe sheet can always be opened.
 * `react-native-razorpay` is NOT — see `features/orders/payment-sheet.ts` for
 * the one-command install and the body to fill in. Flip this when it goes in;
 * nothing else needs to change, because every caller asks rather than assumes.
 */
const RAZORPAY_INSTALLED = false;

export type Provider = "razorpay" | "stripe" | "cod";

export const canOpenSheetFor = (provider: Provider): boolean => {
  if (provider === "cod") return true;
  if (provider === "stripe") return true;

  return RAZORPAY_INSTALLED;
};

/**
 * Whether a card or UPI payment can actually be completed, start to finish.
 *
 * Two independent facts have to hold, and each is owned by a different side.
 * The server knows whether its gateway has keys; the app knows whether this
 * build carries that gateway's SDK. Either one missing and the payment cannot
 * finish, so the row is greyed out with the reason rather than offered.
 *
 * It was offered unconditionally on both sides: the server returned
 * `available: true` for every non-cash method because "the gateway handles
 * them", and the app's Razorpay sheet was a stub that returned a failure. So a
 * customer chose UPI in settings, filled the whole of checkout, and found out
 * at the Pay button — the one screen in the app where that is unforgivable.
 */
export const onlineUsable = (preferences?: PaymentPreferences): boolean =>
  Boolean(preferences?.online.available) &&
  canOpenSheetFor(preferences?.online.provider ?? "razorpay");

/**
 * The basket's payment options, narrowed by what this build can open.
 *
 * The server answers for itself and cannot know what is compiled into the app,
 * so the stricter of the two answers wins here, once, and the picker goes on
 * reading one field. It stays the explanation rather than the guard.
 */
export const withBuildLimits = (
  options: BasketPaymentOptions,
  preferences?: PaymentPreferences,
): BasketPaymentOptions => {
  if (!options.onlineAvailable) return options;

  if (canOpenSheetFor(preferences?.online.provider ?? "razorpay")) return options;

  return {
    ...options,
    onlineAvailable: false,
    onlineUnavailableReason: "This version of Raket cannot take online payment yet",
  };
};

/** Whether a given method can be used on these options. */
export const methodUsable = (method: PaymentMethod, options: BasketPaymentOptions): boolean =>
  method === "cod" ? options.codAvailable : options.onlineAvailable;

/**
 * The method checkout should open on: the customer's own default when they can
 * use it, otherwise whichever side still works. Null when neither does, which
 * is a state checkout has to say out loud rather than paper over with a button.
 */
export const openingMethod = (
  preferred: PaymentMethod,
  options: BasketPaymentOptions,
): PaymentMethod | null => {
  if (methodUsable(preferred, options)) return preferred;
  if (options.onlineAvailable) return "upi";
  if (options.codAvailable) return "cod";

  return null;
};

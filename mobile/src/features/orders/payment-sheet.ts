import { initStripe } from "@stripe/stripe-react-native";

import type { CheckoutSession, Order } from "@/lib/api";
import { BRAND } from "@/lib/brand";

/**
 * Opening a payment sheet, behind one seam.
 *
 * The screen asks for a result; it never learns which gateway produced it. That
 * matters here because OnlineMall runs two: Razorpay for India (UPI, cards,
 * netbanking, wallets) and Stripe, kept for international cards.
 *
 * `react-native-razorpay` is NOT yet a dependency of this app — adding a native
 * module changes the build, so it is left for you to install deliberately:
 *
 *   npx expo install react-native-razorpay
 *   npx expo prebuild --clean        # native module, so a rebuild is required
 *
 * then fill in `openRazorpaySheet` below. Every call site is already correct and
 * nothing else has to change. Until then, set PAYMENT_PROVIDER=stripe on the API,
 * or use cash on delivery, both of which work today.
 */

export type SheetOutcome =
  | { status: "paid" }
  | { status: "cancelled" }
  | { status: "failed"; message: string }
  /** Razorpay hands back a callback the SERVER must verify before anything counts. */
  | { status: "verify"; razorpayOrderId: string; razorpayPaymentId: string; signature: string };

type StripeSheet = {
  initPaymentSheet: (options: Record<string, unknown>) => Promise<{ error?: { message: string } }>;
  presentPaymentSheet: () => Promise<{ error?: { message: string; code: string } }>;
};

const openStripeSheet = async (
  session: CheckoutSession,
  sheet: StripeSheet,
  customerName?: string,
): Promise<SheetOutcome> => {
  await initStripe({ publishableKey: session.publicKey });

  const { error: initError } = await sheet.initPaymentSheet({
    allowsDelayedPaymentMethods: false,
    defaultBillingDetails: { name: customerName },
    merchantDisplayName: BRAND.fullName,
    paymentIntentClientSecret: session.clientSecret,
  });

  if (initError) return { message: initError.message, status: "failed" };

  const { error: sheetError } = await sheet.presentPaymentSheet();

  if (sheetError) {
    // Cancelling is an ordinary choice, not a failure worth shouting about.
    return sheetError.code === "Canceled"
      ? { status: "cancelled" }
      : { message: sheetError.message, status: "failed" };
  }

  return { status: "paid" };
};

const openRazorpaySheet = async (
  _session: CheckoutSession,
  _order: Order,
): Promise<SheetOutcome> => {
  /*
   * Replace this body once the SDK is installed:
   *
   *   import RazorpayCheckout from "react-native-razorpay";
   *
   *   const result = await RazorpayCheckout.open({
   *     key: session.publicKey,
   *     order_id: session.providerOrderId,
   *     amount: session.amount,
   *     currency: session.currency,
   *     name: BRAND.fullName,
   *     description: `Order ${order.reference}`,
   *     prefill: { contact: order.contactPhone, name: order.contactName },
   *     theme: { color: "#116E3C" },
   *   });
   *
   *   return {
   *     razorpayOrderId: result.razorpay_order_id,
   *     razorpayPaymentId: result.razorpay_payment_id,
   *     signature: result.razorpay_signature,
   *     status: "verify",
   *   };
   *
   * Razorpay rejects a cancellation with code 0 (BAD_REQUEST_ERROR / user
   * closed), which maps to { status: "cancelled" }.
   */
  return {
    message: "Online payment is not available in this build yet. Please choose cash on delivery.",
    status: "failed",
  };
};

export const openPaymentSheet = async (
  session: CheckoutSession,
  order: Order,
  sheet: StripeSheet,
  customerName?: string,
): Promise<SheetOutcome> => {
  // Cash on delivery never opens a sheet: the order is already confirmed.
  if (session.provider === "cod") return { status: "paid" };

  return session.provider === "stripe"
    ? openStripeSheet(session, sheet, customerName)
    : openRazorpaySheet(session, order);
};

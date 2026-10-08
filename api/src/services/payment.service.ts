import { Env } from "../config/env.config";
import {
  createRazorpayOrder,
  createRazorpayRefund,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  isRazorpayConfigured,
  verifyRazorpayPaymentSignature,
} from "../config/razorpay.config";
import { getStripe, isStripeConfigured } from "../config/stripe.config";
import mongoose from "mongoose";

import { OrderDocument, OrderModel, PaymentMethod, PaymentProvider } from "../models/order.model";
import { UserDocument, UserModel } from "../models/user.model";
import { BadRequestException } from "../utils/app-error";
import { getCodPolicy } from "./settings.service";

/**
 * The one place a payment provider is spoken to.
 *
 * Controllers never touch an SDK or an HTTP client; they ask for a checkout
 * session or a verdict and get a provider-neutral shape back. Swapping or adding
 * a gateway is a change inside this file.
 */

/** What the client needs to open a payment sheet. */
export type CheckoutSession = {
  provider: PaymentProvider;
  /** Razorpay order id, or a Stripe PaymentIntent client secret. */
  providerOrderId?: string;
  clientSecret?: string;
  /** Publishable identifier the sheet needs. Public by design. */
  publicKey: string;
  amount: number;
  currency: string;
};

/** The only three answers that matter about a payment. */
export type PaymentVerdict = "paid" | "failed" | "pending";

export const CURRENCY = "inr";

/** Which gateway handles a card/UPI payment, from configuration. */
export const activeProvider = (): PaymentProvider =>
  Env.PAYMENT_PROVIDER === "stripe" ? "stripe" : "razorpay";

export const providerFor = (method: PaymentMethod): PaymentProvider =>
  method === "cod" ? "cod" : activeProvider();

export const isProviderConfigured = (provider: PaymentProvider): boolean => {
  if (provider === "cod") return true;
  if (provider === "stripe") return isStripeConfigured() && Boolean(Env.STRIPE_PUBLISHABLE_KEY);

  return isRazorpayConfigured();
};

/**
 * Razorpay auto-refunds any payment that arrives without an order id, so the
 * order must exist on their side before the sheet opens. Notes are server-written
 * only — the webhook trusts them to find our order.
 */
const openRazorpaySession = async (order: OrderDocument): Promise<CheckoutSession> => {
  const created = await createRazorpayOrder({
    amount: order.total,
    currency: CURRENCY,
    // Idempotent on our order id: a retried checkout reuses the same Razorpay
    // order rather than opening a second one the customer could also pay.
    idempotencyKey: `order_${order._id.toString()}`,
    notes: {
      orderId: order._id.toString(),
      reference: order.reference,
      userId: order.userId.toString(),
    },
    receipt: order.reference,
  });

  return {
    amount: created.amount,
    currency: created.currency,
    providerOrderId: created.id,
    provider: "razorpay",
    publicKey: Env.RAZORPAY_KEY_ID,
  };
};

const resolveStripeCustomerId = async (user: UserDocument): Promise<string> => {
  const existing = (user as UserDocument & { stripeCustomerId?: string }).stripeCustomerId;

  if (existing) return existing;

  const customer = await getStripe().customers.create({
    email: user.email,
    metadata: { userId: user._id.toString() },
    name: user.name,
  });

  await UserModel.updateOne({ _id: user._id }, { stripeCustomerId: customer.id }).exec();

  return customer.id;
};

const openStripeSession = async (
  order: OrderDocument,
  user: UserDocument,
): Promise<CheckoutSession> => {
  const intent = await getStripe().paymentIntents.create(
    {
      amount: order.total,
      automatic_payment_methods: { enabled: true },
      currency: CURRENCY,
      customer: await resolveStripeCustomerId(user),
      metadata: {
        orderId: order._id.toString(),
        reference: order.reference,
        userId: order.userId.toString(),
      },
    },
    { idempotencyKey: `order_${order._id.toString()}` },
  );

  return {
    amount: intent.amount,
    clientSecret: intent.client_secret ?? "",
    currency: intent.currency,
    provider: "stripe",
    providerOrderId: intent.id,
    publicKey: Env.STRIPE_PUBLISHABLE_KEY,
  };
};

export const openCheckoutSession = async (
  order: OrderDocument,
  user: UserDocument,
): Promise<CheckoutSession> => {
  const provider = order.paymentProvider;

  if (!isProviderConfigured(provider)) {
    // Fail here, where the reason is still legible, rather than inside the client.
    throw new BadRequestException("Payments are not available right now");
  }

  return provider === "stripe" ? openStripeSession(order, user) : openRazorpaySession(order);
};

/**
 * Verifies the signature the checkout sheet hands back, then confirms against
 * the provider anyway.
 *
 * The signature proves the callback came from Razorpay; it does NOT prove the
 * payment was captured. A client could replay a valid signature from an
 * authorized-but-uncaptured attempt, so the status is read from the API before
 * anything is released.
 */
export const verifyRazorpayCallback = async (input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): Promise<{ verdict: PaymentVerdict; paymentId: string }> => {
  if (!verifyRazorpayPaymentSignature(input)) {
    throw new BadRequestException("Payment could not be verified");
  }

  const payment = await fetchRazorpayPayment(input.razorpayPaymentId);

  if (payment.order_id !== input.razorpayOrderId) {
    throw new BadRequestException("Payment could not be verified");
  }

  return { paymentId: payment.id, verdict: toVerdict(payment.status) };
};

const toVerdict = (status: string): PaymentVerdict => {
  if (status === "captured") return "paid";
  if (status === "failed") return "failed";

  // "authorized" is money held, not taken. Treated as pending so nothing is
  // released against a payment that may still be voided.
  return "pending";
};

/**
 * Reconciles one order against its provider. Used when the app returns from the
 * sheet before the webhook lands, and by any later retry — the verdict always
 * comes from the provider, so a client can never mark its own order paid.
 */
export const fetchPaymentVerdict = async (
  order: OrderDocument,
): Promise<{ verdict: PaymentVerdict; paymentId?: string }> => {
  if (order.paymentProvider === "cod") return { verdict: "pending" };

  if (order.paymentProvider === "stripe") {
    if (!order.paymentIntentId) return { verdict: "pending" };

    const intent = await getStripe().paymentIntents.retrieve(order.paymentIntentId);

    if (intent.status === "succeeded") return { paymentId: intent.id, verdict: "paid" };
    if (intent.status === "canceled") return { paymentId: intent.id, verdict: "failed" };

    return { verdict: "pending" };
  }

  // Razorpay: an order can carry several attempts, so the captured one wins. A
  // single failed attempt means nothing while the customer is still trying.
  if (!order.providerOrderId) return { verdict: "pending" };

  const { items } = await fetchRazorpayOrderPayments(order.providerOrderId);
  const captured = items.find((payment) => payment.status === "captured");

  if (captured) return { paymentId: captured.id, verdict: "paid" };

  const everyAttemptFailed =
    items.length > 0 && items.every((payment) => payment.status === "failed");

  return everyAttemptFailed ? { verdict: "failed" } : { verdict: "pending" };
};

/**
 * Whether this customer may pay cash for a basket of this size, and if not, why.
 *
 * Computed before checkout rather than only enforced at it, so the UI can grey
 * the option out with a reason instead of letting someone fill in an address and
 * then be refused. The same policy is re-checked server-side at order creation —
 * this is for the interface, not instead of the guard.
 */
export const codAvailability = async (
  userId: string,
  total: number,
): Promise<{ available: boolean; maxOrderValue: number; reason?: string }> => {
  const policy = await getCodPolicy();

  if (!policy.enabled) {
    return {
      available: false,
      maxOrderValue: policy.maxOrderValue,
      reason: "Cash on delivery is not available right now",
    };
  }

  if (total > policy.maxOrderValue) {
    return {
      available: false,
      maxOrderValue: policy.maxOrderValue,
      reason: `Available on orders up to \u20B9${Math.floor(policy.maxOrderValue / 100)}`,
    };
  }

  const openCodOrders = await OrderModel.countDocuments({
    codCollectedAt: mongoose.trusted({ $exists: false }),
    paymentMethod: "cod",
    status: mongoose.trusted({ $in: ["confirmed", "preparing", "ready", "out_for_delivery"] }),
    userId,
  }).exec();

  if (openCodOrders >= policy.maxOpenOrders) {
    return {
      available: false,
      maxOrderValue: policy.maxOrderValue,
      reason: "You already have a cash order on the way",
    };
  }

  return { available: true, maxOrderValue: policy.maxOrderValue };
};

export type RefundResult = {
  refundId: string | null;
  amount: number;
  /** "gateway" went back to the card/UPI; "manual" is cash the shop owes back. */
  via: "gateway" | "manual";
};

/**
 * Refunds an order.
 *
 * Two genuinely different cases, and conflating them is how a customer gets told
 * money is on its way when nobody has sent any:
 *
 *  - PREPAID: reversed through the gateway, back to the method they paid with.
 *  - CASH ON DELIVERY: there is nothing to reverse. If the rider never collected,
 *    the customer is simply not charged; if they did, the refund is a cash
 *    hand-back the shop settles, recorded here so it is not forgotten.
 *
 * Idempotent on the order id, so a double-click cannot pay the customer twice.
 */
export const refundOrder = async (
  order: OrderDocument,
  amount: number,
  reason: string,
): Promise<RefundResult> => {
  if (order.paymentMethod === "cod") {
    return { amount, refundId: null, via: "manual" };
  }

  if (!order.paymentIntentId) {
    throw new BadRequestException("This order has no captured payment to refund");
  }

  if (order.paymentProvider === "stripe") {
    const refund = await getStripe().refunds.create(
      { amount, payment_intent: order.paymentIntentId, reason: "requested_by_customer" },
      { idempotencyKey: `refund_${order._id.toString()}` },
    );

    return { amount, refundId: refund.id, via: "gateway" };
  }

  const refund = await createRazorpayRefund({
    amount,
    idempotencyKey: `refund_${order._id.toString()}`,
    notes: { orderId: order._id.toString(), reason, reference: order.reference },
    paymentId: order.paymentIntentId,
  });

  return { amount: refund.amount, refundId: refund.id, via: "gateway" };
};

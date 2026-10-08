import { createHmac, timingSafeEqual } from "node:crypto";

import { Env } from "./env.config";

/**
 * Razorpay, over its REST API rather than the `razorpay` npm SDK.
 *
 * Two reasons. The REST surface used here is three endpoints and never changes
 * shape, so the SDK buys nothing but a dependency. And both signature schemes
 * below are plain HMAC-SHA256, which `node:crypto` already does — pulling in a
 * package to call `createHmac` for us would be adding a supply-chain surface to
 * a payments path for no gain.
 *
 * Node 22 ships global `fetch`, so there is no HTTP client to add either.
 */

const API_BASE = "https://api.razorpay.com/v1";

/** Payments are optional at boot, so the API still runs before keys are added. */
export const isRazorpayConfigured = () =>
  Boolean(Env.RAZORPAY_KEY_ID && Env.RAZORPAY_KEY_SECRET);

const authHeader = () =>
  `Basic ${Buffer.from(`${Env.RAZORPAY_KEY_ID}:${Env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

/**
 * One request helper for every call.
 *
 * `idempotencyKey` matters on create: a retried order-create must not open a
 * second Razorpay order for the same basket, which would let one checkout be
 * paid twice.
 */
const request = async <T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string } = { method: "GET" },
): Promise<T> => {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    body: init.body ? JSON.stringify(init.body) : undefined,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Razorpay-Idempotency-Key": init.idempotencyKey } : {}),
    },
    method: init.method,
    // A hung gateway must not hold a checkout request open indefinitely.
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { description?: string; code?: string };
  };

  if (!response.ok) {
    // Razorpay's own description is safe to surface — it is written for the
    // merchant, not the cardholder, and carries no payment details.
    throw new RazorpayError(
      payload.error?.description ?? "Payment could not be started",
      response.status,
      payload.error?.code,
    );
  }

  return payload as T;
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: "created" | "attempted" | "paid";
  receipt?: string;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  /** "captured" is the only status that means money has actually moved. */
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  method?: string;
  error_description?: string;
};

/**
 * Orders are immutable and do not expire. A changed amount needs a NEW order, so
 * the caller must never reuse one across baskets — but a retry of the SAME
 * basket should reuse it, which is what the idempotency key buys.
 */
export const createRazorpayOrder = (input: {
  amount: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
  idempotencyKey: string;
}) =>
  request<RazorpayOrder>("/orders", {
    body: {
      amount: input.amount,
      currency: input.currency,
      notes: input.notes,
      receipt: input.receipt,
    },
    idempotencyKey: input.idempotencyKey,
    method: "POST",
  });

export type RazorpayRefund = {
  id: string;
  payment_id: string;
  amount: number;
  status: "pending" | "processed" | "failed";
};

/**
 * Refunds a captured payment, in full or in part.
 *
 * Idempotent on the caller's key so a retried refund — a double-click, a network
 * retry — cannot pay the customer twice. Razorpay returns the ORIGINAL refund for
 * a repeated key rather than creating a second one.
 */
export const createRazorpayRefund = (input: {
  paymentId: string;
  /** Paise. Omit to refund the whole payment. */
  amount?: number;
  notes: Record<string, string>;
  idempotencyKey: string;
}) =>
  request<RazorpayRefund>(`/payments/${input.paymentId}/refund`, {
    body: {
      notes: input.notes,
      // speed "normal" settles to the original method in 5-7 working days;
      // "optimum" costs extra. Normal is the honest default for a kirana.
      speed: "normal",
      ...(input.amount ? { amount: input.amount } : {}),
    },
    idempotencyKey: input.idempotencyKey,
    method: "POST",
  });

export const fetchRazorpayPayment = (paymentId: string) =>
  request<RazorpayPayment>(`/payments/${paymentId}`);

export const fetchRazorpayOrderPayments = (orderId: string) =>
  request<{ items: RazorpayPayment[] }>(`/orders/${orderId}/payments`);

/** Constant-time compare that tolerates length mismatch without throwing. */
const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
};

/**
 * Checkout callback signature.
 *
 * HMAC-SHA256 of `order_id|payment_id`, keyed with the API KEY SECRET. This is
 * NOT the webhook signature — different key, different message — and mixing the
 * two is the single most common Razorpay integration bug.
 */
export const verifyRazorpayPaymentSignature = (input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean => {
  if (!Env.RAZORPAY_KEY_SECRET) return false;

  const expected = createHmac("sha256", Env.RAZORPAY_KEY_SECRET)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");

  return safeEqual(expected, input.signature);
};

/**
 * Webhook signature.
 *
 * HMAC-SHA256 of the RAW request body, keyed with the WEBHOOK SECRET. The raw
 * bytes matter: re-stringifying parsed JSON reorders keys and changes
 * whitespace, and every verification then fails.
 */
export const verifyRazorpayWebhookSignature = (rawBody: Buffer, signature: string): boolean => {
  if (!Env.RAZORPAY_WEBHOOK_SECRET) return false;

  const expected = createHmac("sha256", Env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return safeEqual(expected, signature);
};

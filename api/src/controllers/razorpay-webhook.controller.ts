import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { Env } from "../config/env.config";
import { isRazorpayConfigured, verifyRazorpayWebhookSignature } from "../config/razorpay.config";
import { PaymentEventModel } from "../models/payment-event.model";
import { markOrderPaid, markOrderPaymentFailed } from "../services/order.service";
import { logger } from "../utils/logger";

/**
 * Payment state is only ever changed from here and from the server-side status
 * check. The app returning from the checkout sheet is user experience, not proof
 * that money moved.
 *
 * Mounted with the raw body, because the signature covers the exact bytes
 * Razorpay sent; parsing and re-stringifying reorders keys and changes
 * whitespace, and every verification then fails.
 */
type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string; status?: string };
    };
  };
};

export const razorpayWebhookController = async (request: Request, response: Response) => {
  if (!isRazorpayConfigured() || !Env.RAZORPAY_WEBHOOK_SECRET) {
    return response.status(HTTPSTATUS.NOT_FOUND).json({ message: "Webhook not configured" });
  }

  const raw = request.body as Buffer;
  const signature = request.headers["x-razorpay-signature"];

  if (
    !Buffer.isBuffer(raw) ||
    typeof signature !== "string" ||
    !verifyRazorpayWebhookSignature(raw, signature)
  ) {
    logger.warn("Rejected Razorpay webhook", { reason: "signature" });

    return response.status(HTTPSTATUS.BAD_REQUEST).json({ message: "Invalid signature" });
  }

  let event: RazorpayWebhookBody;

  try {
    event = JSON.parse(raw.toString("utf8")) as RazorpayWebhookBody;
  } catch {
    return response.status(HTTPSTATUS.BAD_REQUEST).json({ message: "Invalid payload" });
  }

  const payment = event.payload?.payment?.entity;

  if (!event.event || !payment?.id) {
    // Verified but not something we act on — acknowledge so it is not retried.
    return response.status(HTTPSTATUS.OK).json({ received: true, ignored: true });
  }

  /**
   * Razorpay does not send a delivery id we can rely on, so the dedupe key is
   * built from the event type and the payment it concerns. That is the real
   * invariant anyway: "this payment was captured" should be processed once
   * however many times it is delivered.
   */
  const eventId = `${event.event}:${payment.id}`;

  try {
    await PaymentEventModel.create({ eventId, provider: "razorpay", type: event.event });
  } catch {
    return response.status(HTTPSTATUS.OK).json({ received: true, duplicate: true });
  }

  try {
    switch (event.event) {
      case "payment.captured":
        await markOrderPaid(payment.id, { providerOrderId: payment.order_id });
        break;

      case "payment.failed":
        await markOrderPaymentFailed(payment.id, { providerOrderId: payment.order_id });
        break;

      default:
        break;
    }
  } catch (error) {
    // Let the receipt go so Razorpay can retry into a clean state.
    await PaymentEventModel.deleteOne({ eventId, provider: "razorpay" }).exec();

    logger.error("Razorpay webhook handler failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      type: event.event,
    });

    return response
      .status(HTTPSTATUS.INTERNAL_SERVER_ERROR)
      .json({ message: "Webhook handling failed" });
  }

  return response.status(HTTPSTATUS.OK).json({ received: true });
};

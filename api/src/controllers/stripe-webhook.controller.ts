import { Request, Response } from "express";
import Stripe from "stripe";

import { Env } from "../config/env.config";
import { HTTPSTATUS } from "../config/http-status.config";
import { getStripe, isStripeConfigured } from "../config/stripe.config";
import { PaymentEventModel } from "../models/payment-event.model";
import { markOrderPaid, markOrderPaymentFailed } from "../services/order.service";
import { logger } from "../utils/logger";

/**
 * Payment state is only ever changed from here. The app returning from the
 * payment sheet is user experience, not proof that money moved.
 *
 * Mounted with the raw body, because the signature covers the exact bytes
 * Stripe sent; parsing first would invalidate it.
 */
export const stripeWebhookController = async (request: Request, response: Response) => {
  if (!isStripeConfigured() || !Env.STRIPE_WEBHOOK_SECRET) {
    return response.status(HTTPSTATUS.NOT_FOUND).json({ message: "Webhook not configured" });
  }

  const signature = request.headers["stripe-signature"];
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      request.body as Buffer,
      typeof signature === "string" ? signature : "",
      Env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    logger.warn("Rejected Stripe webhook", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return response.status(HTTPSTATUS.BAD_REQUEST).json({ message: "Invalid signature" });
  }

  // Stripe retries, so the same event can arrive twice. First writer wins.
  try {
    await PaymentEventModel.create({ eventId: event.id, provider: "stripe", type: event.type });
  } catch {
    return response.status(HTTPSTATUS.OK).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await markOrderPaid((event.data.object as Stripe.PaymentIntent).id);
        break;

      case "payment_intent.payment_failed":
        await markOrderPaymentFailed((event.data.object as Stripe.PaymentIntent).id);
        break;

      default:
        break;
    }
  } catch (error) {
    // Let the receipt go so Stripe can retry into a clean state.
    await PaymentEventModel.deleteOne({ eventId: event.id, provider: "stripe" }).exec();

    logger.error("Stripe webhook handler failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      type: event.type,
    });

    return response
      .status(HTTPSTATUS.INTERNAL_SERVER_ERROR)
      .json({ message: "Webhook handling failed" });
  }

  return response.status(HTTPSTATUS.OK).json({ received: true });
};

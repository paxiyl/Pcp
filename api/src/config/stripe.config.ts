import Stripe from "stripe";

import { Env } from "./env.config";

let client: Stripe | null = null;

/** Payments are optional at boot, so the API still runs before keys are added. */
export const isStripeConfigured = () => Boolean(Env.STRIPE_SECRET_KEY);

export const getStripe = (): Stripe => {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }

  // One client per process; the SDK pins its own API version.
  client ??= new Stripe(Env.STRIPE_SECRET_KEY);

  return client;
};

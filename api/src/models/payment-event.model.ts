import { Document, model, Schema } from "mongoose";

export type PaymentEventProvider = "stripe" | "razorpay";

export interface PaymentEventDocument extends Document {
  provider: PaymentEventProvider;
  eventId: string;
  type: string;
  processedAt: Date;
}

/**
 * Webhook receipts, for idempotency. Replaces the Stripe-only `StripeEvent`
 * model now that two providers deliver here.
 *
 * Both providers retry and can deliver out of order. The unique (provider,
 * eventId) pair makes processing idempotent: a duplicate insert fails and we
 * skip the work. The pair rather than eventId alone, because nothing guarantees
 * two gateways will not mint the same opaque id.
 */
const paymentEventSchema = new Schema<PaymentEventDocument>({
  provider: { type: String, enum: ["stripe", "razorpay"], required: true },
  eventId: { type: String, required: true },
  type: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
});

paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

// Webhook receipts are only useful for a short window.
paymentEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const PaymentEventModel = model<PaymentEventDocument>("PaymentEvent", paymentEventSchema);

import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/**
 * The client chooses where the order goes and how to reach them. It never
 * sends prices, items, or a total: those come from the stored basket.
 */
export const createOrderSchema = z.object({
  addressId: objectId.optional(),
  /**
   * How to pay. Which gateway serves a non-cash method is a server decision, so
   * the client picks a method and never a provider.
   */
  paymentMethod: z.enum(["upi", "card", "netbanking", "wallet", "cod"]).default("upi"),
  contactPhone: z.string().trim().min(6).max(32).optional(),
  deliveryInstructions: z.string().trim().max(200).optional(),
});

export const orderIdSchema = z.object({ orderId: objectId });

/**
 * What the Razorpay checkout sheet hands back. All three are verified
 * server-side before anything is released — the signature proves the callback
 * is authentic, and the payment status is then read from Razorpay itself.
 */
export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(4).max(64),
  razorpayPaymentId: z.string().trim().min(4).max(64),
  signature: z.string().trim().regex(/^[a-f0-9]{64}$/i, "Invalid signature"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

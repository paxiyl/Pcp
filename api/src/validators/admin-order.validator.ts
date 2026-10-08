import { z } from "zod";

import { ORDER_STATUSES } from "../models/order.model";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const adminOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(80).optional(),
  restaurantId: objectId.optional(),
  customerId: objectId.optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  range: z.enum(["today", "7d", "30d", "all"]).default("all"),
});

export const orderIdParamSchema = z.object({ orderId: objectId });

/** Only the kitchen path; pick-up and delivery belong to the rider app. */
export const updateStatusSchema = z.object({
  status: z.enum(["preparing", "ready", "cancelled"]),
});

export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;

/**
 * Refund input. `amount` omitted means "the whole unrefunded balance", which is
 * the common case and should not require the admin to retype a total.
 */
export const refundOrderSchema = z.object({
  amount: z.number().int().min(1).optional(),
  reason: z.string().trim().min(3, "Say why, for the audit trail").max(200),
});

export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

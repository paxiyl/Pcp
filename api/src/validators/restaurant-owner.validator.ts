import { z } from "zod";

import { dishSchema, dishUpdateSchema } from "./restaurant.validator";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const ownerDishIdSchema = z.object({ dishId: objectId });
export const ownerDishesQuerySchema = z.object({
  search: z.string().trim().min(1).max(80).optional(),
});

/**
 * What a restaurant may set on its own dishes.
 *
 * `isPopular` is withheld for the same reason the shop schema withholds rating:
 * it is a merchandising signal the rails sort by, and a kitchen that could
 * flag its whole menu as popular would flatten it into noise.
 */
export const ownerDishSchema = dishSchema.omit({ isPopular: true });
export const ownerDishUpdateSchema = dishUpdateSchema.omit({ isPopular: true });

export const setRestaurantOpenSchema = z.object({ isOpen: z.boolean() });

export const ownerOrderIdSchema = z.object({ orderId: objectId });

export const ownerOrdersQuerySchema = z.object({
  status: z
    .enum([
      "pending_payment",
      "payment_failed",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ])
    .optional(),
});

/** Only the two a kitchen owns. The service enforces this too. */
export const advanceKitchenOrderSchema = z.object({
  status: z.enum(["preparing", "ready"]),
});

export type OwnerDishInput = z.infer<typeof ownerDishSchema>;
export type OwnerDishUpdateInput = z.infer<typeof ownerDishUpdateSchema>;

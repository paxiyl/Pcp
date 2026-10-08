import { z } from "zod";

import { productSchema, productUpdateSchema } from "./store.validator";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const ownerOrderIdSchema = z.object({ orderId: objectId });
export const ownerProductIdSchema = z.object({ productId: objectId });

/** Only the two moves a shop actually owns. See SHOP_TRANSITIONS. */
export const advanceOrderSchema = z.object({
  status: z.enum(["preparing", "ready"]),
});

export const ownerOrdersQuerySchema = z.object({
  status: z
    .enum(["confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"])
    .optional(),
});

/**
 * Stock and listing only. Price is deliberately absent — it is a commercial
 * agreement, and a price that can move from a phone can change a basket's total
 * between adding an item and paying for it.
 */
export const updateStockSchema = z
  .object({
    stock: z.number().int().min(0).max(100_000).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide a stock count or a listing change",
  });

export const setOpenSchema = z.object({ isOpen: z.boolean() });
export const ownerProductsQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
});

export type AdvanceOrderInput = z.infer<typeof advanceOrderSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;

/**
 * What a shopkeeper may set on their own products.
 *
 * Derived from the backoffice schema minus three fields, because a shop that
 * could set its own rating, review count or "popular" flag would be scoring its
 * own homework — and those signals are what every listing and rail sorts by.
 * Price IS included: an owner adding their own stock has to say what it costs.
 */
export const ownerProductSchema = productSchema.omit({
  isPopular: true,
  rating: true,
  ratingCount: true,
});

export const ownerProductUpdateSchema = productUpdateSchema.omit({
  isPopular: true,
  rating: true,
  ratingCount: true,
});

export type OwnerProductInput = z.infer<typeof ownerProductSchema>;
export type OwnerProductUpdateInput = z.infer<typeof ownerProductUpdateSchema>;

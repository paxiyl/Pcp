import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const addBasketItemSchema = z.object({
  dishId: objectId,
  optionIds: z.array(objectId).max(20).default([]),
  quantity: z.number().int().min(1).max(50).default(1),
  note: z.string().trim().max(200).optional(),
});

/**
 * A product line has no options and no note: a 1 kg pack of atta is the same pack
 * however it is ordered. Quantity is capped at 50 here and again, properly,
 * against the product's own stock and maxPerOrder in the service.
 */
export const addBasketProductSchema = z.object({
  productId: objectId,
  quantity: z.number().int().min(1).max(50).default(1),
});

export const basketItemIdSchema = z.object({ itemId: objectId });

export const itemQuantitySchema = z.object({
  // Zero removes the line, which keeps the stepper and the bin one endpoint.
  quantity: z.number().int().min(0).max(50),
});

export const basketSettingsSchema = z.object({
  includeCutlery: z.boolean().optional(),
  orderNote: z.string().trim().max(300).optional(),
});

export type AddBasketItemInput = z.infer<typeof addBasketItemSchema>;
export type AddBasketProductInput = z.infer<typeof addBasketProductSchema>;
export type BasketSettingsInput = z.infer<typeof basketSettingsSchema>;

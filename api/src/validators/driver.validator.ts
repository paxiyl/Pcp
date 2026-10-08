import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const deliveryIdSchema = z.object({ orderId: objectId });

export const onlineSchema = z.object({ isOnline: z.boolean() });

export const completeDeliverySchema = z.object({
  code: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit code"),
});

import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const createStoreOwnerSchema = z.object({
  name: z.string().trim().min(2, "Enter the owner's name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(32).optional(),
  password: z.string().min(8, "Use at least 8 characters").max(64),
  /** The shop this account will run. Required: an owner with no shop can do nothing. */
  storeId: objectId,
});

/**
 * PATCH is partial. Written out rather than derived with .partial(), because Zod
 * still applies a field's .default() when the key is absent, which would reset
 * an unrelated field on every edit.
 *
 * Password and email are deliberately absent: a password reset is its own flow,
 * and changing the email of a live account is an identity change, not an edit.
 */
export const updateStoreOwnerSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(32).optional(),
    isActive: z.boolean().optional(),
    storeId: objectId.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one change",
  });

export const storeOwnerQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
});

export const storeOwnerIdSchema = z.object({ ownerId: objectId });

export type CreateStoreOwnerInput = z.infer<typeof createStoreOwnerSchema>;
export type UpdateStoreOwnerInput = z.infer<typeof updateStoreOwnerSchema>;
export type StoreOwnerQuery = z.infer<typeof storeOwnerQuerySchema>;

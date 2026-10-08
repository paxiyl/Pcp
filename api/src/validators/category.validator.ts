import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(40),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens")
    .optional(),
  imageUrl: z.string().url("Enter a valid image URL").or(z.literal("")).default(""),
  imagePublicId: z.string().trim().optional(),
  backgroundColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour such as #FFE9D6")
    .default("#F3F6F5"),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid category id");

/**
 * PATCH is partial. Written out rather than derived with .partial(), because Zod
 * still applies a field's .default() when the key is absent — a deactivate that
 * sends only isActive would otherwise blank the image and reset the tint.
 */
export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens")
    .optional(),
  imageUrl: z.string().url("Enter a valid image URL").or(z.literal("")).optional(),
  imagePublicId: z.string().trim().optional(),
  backgroundColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour such as #FFE9D6")
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/** The display order, sent for every row the admin moved, in one request. */
export const categoryReorderSchema = z.object({
  categories: z
    .array(z.object({ id: objectId, sortOrder: z.number().int().min(0).max(999) }))
    .min(1)
    .max(100),
});

export const categoryIdSchema = z.object({ id: objectId });

export type CategoryInput = z.infer<typeof categorySchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type CategoryReorderInput = z.infer<typeof categoryReorderSchema>;

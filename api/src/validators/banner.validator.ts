import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid banner id");

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * An ISO string becomes a Date; an empty string means "clear this date".
 *
 * The admin form sends plain days. A day means the whole day, so an end date
 * runs to its last millisecond — otherwise "ends 30 Oct" would stop the banner
 * at midnight and it would never appear on the 30th at all.
 */
const optionalDate = (edge: "start" | "end") =>
  z
    .string()
    .trim()
    .transform((value) => {
      if (value === "") return null;
      if (!DATE_ONLY.test(value)) return new Date(value);

      return new Date(`${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
    })
    .refine((value) => value === null || !Number.isNaN(value.getTime()), "Enter a valid date")
    .optional();

export const bannerSchema = z.object({
  title: z.string().trim().min(2, "Enter a banner title").max(80),
  subtitle: z.string().trim().max(120).default(""),
  imageUrl: z.string().url("Enter a valid image URL").or(z.literal("")).default(""),
  imagePublicId: z.string().trim().optional(),
  categorySlug: z.string().trim().max(40).optional(),
  startsAt: optionalDate("start"),
  endsAt: optionalDate("end"),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * PATCH is partial. Written out rather than derived with .partial(), because Zod
 * still applies a field's .default() when the key is absent, which would blank
 * the subtitle and the artwork on an unrelated edit.
 */
export const bannerUpdateSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  subtitle: z.string().trim().max(120).optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  imagePublicId: z.string().trim().optional(),
  categorySlug: z.string().trim().max(40).optional(),
  startsAt: optionalDate("start"),
  endsAt: optionalDate("end"),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** The display order, sent for every row, in one request. */
export const bannerReorderSchema = z.object({
  banners: z
    .array(z.object({ id: objectId, sortOrder: z.number().int().min(0).max(999) }))
    .min(1)
    .max(100),
});

export const bannerIdSchema = z.object({ id: objectId });

export type BannerInput = z.infer<typeof bannerSchema>;
export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;
export type BannerReorderInput = z.infer<typeof bannerReorderSchema>;

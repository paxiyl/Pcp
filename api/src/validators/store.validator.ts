import { z } from "zod";
import { PRESET_KEYS } from "../config/image-presets";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm");

export const storeSchema = z.object({
  name: z.string().trim().min(2, "Enter a store name").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens")
    .optional(),
  storeType: z.string().trim().min(2).max(40).default("Kirana"),
  description: z.string().trim().max(400).default(""),
  imageUrl: z.string().url("Enter a valid image URL").or(z.literal("")).default(""),
  imagePublicId: z.string().trim().optional(),
  coverUrl: z.string().url("Enter a valid image URL").or(z.literal("")).default(""),
  coverPublicId: z.string().trim().optional(),
  categories: z.array(objectId).max(20).default([]),
  rating: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().min(0).default(0),
  etaMinutes: z.number().int().min(1).max(240).default(20),
  // Money arrives in minor units (paise) so nothing is ever a float.
  deliveryFee: z.number().int().min(0).default(0),
  minOrder: z.number().int().min(0).default(0),
  freeDeliveryThreshold: z.number().int().min(0).optional(),
  address: z.string().trim().max(200).default(""),
  area: z.string().trim().max(80).default(""),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  closesAt: hhmm.default("22:00"),
  isOpen: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  /** Overrides the platform rate for this store only. */
  commissionRate: z.number().min(0).max(0.5).optional(),
});

/**
 * PATCH is partial. Written out rather than derived with .partial(), because Zod
 * still applies a field's .default() when the key is absent — which would
 * silently reset every field the caller did not send.
 */
export const storeUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).optional(),
  storeType: z.string().trim().min(2).max(40).optional(),
  description: z.string().trim().max(400).optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  imagePublicId: z.string().trim().optional(),
  coverUrl: z.string().url().or(z.literal("")).optional(),
  coverPublicId: z.string().trim().optional(),
  categories: z.array(objectId).max(20).optional(),
  rating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().int().min(0).optional(),
  etaMinutes: z.number().int().min(1).max(240).optional(),
  deliveryFee: z.number().int().min(0).optional(),
  minOrder: z.number().int().min(0).optional(),
  freeDeliveryThreshold: z.number().int().min(0).optional(),
  address: z.string().trim().max(200).optional(),
  area: z.string().trim().max(80).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  closesAt: hhmm.optional(),
  isOpen: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  commissionRate: z.number().min(0).max(0.5).optional(),
});

/**
 * `mrp` defaults to `price` so a product with no discount does not have to carry
 * the same number twice. The model clamps the pair anyway, because an MRP below
 * the price is a data-entry mistake that would render a negative discount badge.
 */
export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(600).default(""),
  imageUrl: z.string().url("Enter a valid image URL").or(z.literal("")).default(""),
  imagePublicId: z.string().trim().optional(),
  /**
   * A preset tile instead of a photograph. Validated against the catalogue so a
   * client cannot store a key nothing can draw; empty string clears it.
   */
  imagePreset: z.enum(PRESET_KEYS as [string, ...string[]]).or(z.literal("")).optional(),
  unit: z.string().trim().min(1, "Enter a pack size, such as 1 kg").max(40),
  brand: z.string().trim().max(60).default(""),
  categoryId: objectId,
  price: z.number().int().min(0, "Price is in paise"),
  mrp: z.number().int().min(0).optional(),
  rating: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().min(0).default(0),
  stock: z.number().int().min(0).default(0),
  maxPerOrder: z.number().int().min(1).max(100).default(10),
  isAvailable: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  sortOrder: z.number().int().min(0).optional(),
  variantGroupId: objectId.optional(),
  variantLabel: z.string().trim().max(40).optional(),
  variantType: z.string().trim().max(30).optional(),
  isDefaultVariant: z.boolean().optional(),
  requiresPrescription: z.boolean().optional(),
});

export const productUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(600).optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  imagePublicId: z.string().trim().optional(),
  imagePreset: z.enum(PRESET_KEYS as [string, ...string[]]).or(z.literal("")).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  brand: z.string().trim().max(60).optional(),
  categoryId: objectId.optional(),
  price: z.number().int().min(0).optional(),
  mrp: z.number().int().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().int().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  maxPerOrder: z.number().int().min(1).max(100).optional(),
  isAvailable: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  sortOrder: z.number().int().min(0).optional(),
  variantGroupId: objectId.optional(),
  variantLabel: z.string().trim().max(40).optional(),
  variantType: z.string().trim().max(30).optional(),
  isDefaultVariant: z.boolean().optional(),
  requiresPrescription: z.boolean().optional(),
});

export const productCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).optional(),
  imageUrl: z.string().url().or(z.literal("")).default(""),
  imagePublicId: z.string().trim().optional(),
  backgroundColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, "Use a 6-digit hex colour")
    .default("#E8F6EC"),
  parentId: objectId.nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const productCategoryUpdateSchema = productCategorySchema.partial();

export const storeIdSchema = z.object({ id: objectId });
export const productIdSchema = z.object({ id: objectId });
export const storeSlugSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/i, "Invalid store"),
});

export const storeQuerySchema = z.object({
  category: z.string().trim().max(60).optional(),
  storeType: z.string().trim().max(40).optional(),
  area: z.string().trim().max(80).optional(),
  search: z.string().trim().max(80).optional(),
});

/**
 * Product browsing. Pagination is offset-based to match the admin's existing
 * tables; a product list is short enough per category that cursors would buy
 * nothing.
 */
export const productQuerySchema = z.object({
  storeId: objectId.optional(),
  categoryId: objectId.optional(),
  category: z.string().trim().max(60).optional(),
  search: z.string().trim().max(80).optional(),
  brand: z.string().trim().max(60).optional(),
  /** "popular" surfaces merchandised rows; "discount" drives the deals rail. */
  sort: z.enum(["popular", "price-asc", "price-desc", "discount", "rating"]).optional(),
  inStockOnly: z.coerce.boolean().optional(),
  /** Returns every SKU rather than one per article. For the admin, not the app. */
  includeVariants: z.coerce.boolean().optional(),
  /** Hides prescription-only medicine from a general browse. */
  excludePrescription: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export type StoreInput = z.infer<typeof storeSchema>;
export type StoreUpdateInput = z.infer<typeof storeUpdateSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductCategoryInput = z.infer<typeof productCategorySchema>;
export type ProductCategoryUpdateInput = z.infer<typeof productCategoryUpdateSchema>;
export type StoreQuery = z.infer<typeof storeQuerySchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;

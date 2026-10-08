import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const restaurantSchema = z.object({
  name: z.string().trim().min(2, "Enter a restaurant name").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens")
    .optional(),
  description: z.string().trim().max(400).default(""),
  imageUrl: z.string().url("Enter a valid image URL").or(z.literal("")).default(""),
  imagePublicId: z.string().trim().optional(),
  cuisines: z.array(z.string().trim().min(1).max(40)).max(6).default([]),
  categories: z.array(objectId).max(10).default([]),
  rating: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().min(0).default(0),
  prepTimeMinMinutes: z.number().int().min(0).max(240).default(20),
  prepTimeMaxMinutes: z.number().int().min(0).max(240).default(30),
  // Money arrives in minor units (cents) so nothing is ever a float.
  deliveryFee: z.number().int().min(0).default(0),
  minOrder: z.number().int().min(0).default(0),
  freeDeliveryThreshold: z.number().int().min(0).optional(),
  address: z.string().trim().max(200).default(""),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm").default("22:00"),
  isOpen: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  /** Overrides the platform rate for this restaurant only. */
  commissionRate: z.number().min(0).max(0.5).optional(),
});

/**
 * PATCH is partial: anything omitted keeps the value it already had.
 *
 * Written out rather than derived with .partial(), because Zod still applies a
 * field's .default() when the key is absent — which would silently reset every
 * field the caller did not send.
 */
export const restaurantUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(400).optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  imagePublicId: z.string().trim().optional(),
  cuisines: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  categories: z.array(objectId).max(10).optional(),
  rating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().int().min(0).optional(),
  prepTimeMinMinutes: z.number().int().min(0).max(240).optional(),
  prepTimeMaxMinutes: z.number().int().min(0).max(240).optional(),
  deliveryFee: z.number().int().min(0).optional(),
  minOrder: z.number().int().min(0).optional(),
  freeDeliveryThreshold: z.number().int().min(0).optional(),
  address: z.string().trim().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  closesAt: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm")
    .optional(),
  isOpen: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  commissionRate: z.number().min(0).max(0.5).optional(),
});

/**
 * The id is echoed back by the admin editor so an untouched group or choice
 * keeps the id baskets and past orders already reference; a new one omits it
 * and Mongoose mints one.
 */
const dishOptionSchema = z.object({
  _id: objectId.optional(),
  name: z.string().trim().min(1).max(60),
  priceDelta: z.number().int().min(0).default(0),
  isDefault: z.boolean().optional(),
});

const dishOptionGroupSchema = z.object({
  _id: objectId.optional(),
  name: z.string().trim().min(1).max(60),
  type: z.enum(["single", "multiple"]).default("single"),
  required: z.boolean().default(false),
  options: z.array(dishOptionSchema).max(20).default([]),
});

export const dishSchema = z.object({
  name: z.string().trim().min(2, "Enter a dish name").max(80),
  description: z.string().trim().max(300).default(""),
  imageUrl: z.string().url("Enter a valid image URL").or(z.literal("")).default(""),
  imagePublicId: z.string().trim().optional(),
  price: z.number().int().min(0, "Price is in cents"),
  calories: z.number().int().min(0).optional(),
  allergens: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  optionGroups: z.array(dishOptionGroupSchema).max(10).default([]),
  section: z.string().trim().min(1).max(40).default("Popular"),
  isPopular: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * PATCH is partial. Written out rather than derived with .partial(), because
 * Zod still applies a field's .default() when the key is absent — which would
 * quietly wipe a dish's option groups on an unrelated edit.
 */
export const dishUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  imagePublicId: z.string().trim().optional(),
  price: z.number().int().min(0).optional(),
  calories: z.number().int().min(0).optional(),
  allergens: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  optionGroups: z.array(dishOptionGroupSchema).max(10).optional(),
  section: z.string().trim().min(1).max(40).optional(),
  isPopular: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const restaurantIdSchema = z.object({ id: objectId });
export const dishIdSchema = z.object({ id: objectId });
export const restaurantSlugSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/i, "Invalid restaurant"),
});

export const restaurantQuerySchema = z.object({
  category: z.string().trim().max(40).optional(),
  search: z.string().trim().max(80).optional(),
});

export type RestaurantInput = z.infer<typeof restaurantSchema>;
export type RestaurantUpdateInput = z.infer<typeof restaurantUpdateSchema>;
export type DishInput = z.infer<typeof dishSchema>;
export type DishUpdateInput = z.infer<typeof dishUpdateSchema>;
export type RestaurantQuery = z.infer<typeof restaurantQuerySchema>;

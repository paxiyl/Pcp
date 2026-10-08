import { z } from "zod";

export const adminRestaurantQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(80).optional(),
  cuisine: z.string().trim().max(40).optional(),
  // Only two states exist on the model; there is no "temporarily closed" flag.
  status: z.enum(["active", "inactive"]).optional(),
});

export type AdminRestaurantQuery = z.infer<typeof adminRestaurantQuerySchema>;

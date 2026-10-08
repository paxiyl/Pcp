import { z } from "zod";

import { ADDRESS_LABELS } from "../models/user-address.model";

export const addressSchema = z.object({
  label: z.enum(ADDRESS_LABELS).default("Home"),
  line1: z.string().trim().min(1, "Enter your street and building").max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1, "Enter your city or town").max(80),
  postcode: z.string().trim().min(1, "Enter your postcode").max(16),
  instructions: z.string().trim().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});

export const addressIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid address id"),
});

export type AddressInput = z.infer<typeof addressSchema>;

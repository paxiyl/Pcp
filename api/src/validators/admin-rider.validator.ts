import { z } from "zod";

import { DRIVER_STATUSES } from "../models/user.model";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid rider id");

export const adminRiderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(80).optional(),
  verification: z.enum(DRIVER_STATUSES).optional(),
});

export const createRiderSchema = z.object({
  name: z.string().trim().min(2, "Enter the rider's name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(32).optional(),
  password: z.string().min(8, "Use at least 8 characters").max(64),
  driverStatus: z.enum(DRIVER_STATUSES).default("approved"),
});

/**
 * PATCH is partial. Written out rather than derived with .partial(), because Zod
 * still applies a field's .default() when the key is absent, which would reset
 * a rider's approval on an unrelated edit.
 */
export const updateRiderSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(32).optional(),
  driverStatus: z.enum(DRIVER_STATUSES).optional(),
  isActive: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const riderIdParamSchema = z.object({ riderId: objectId });

export type AdminRiderQuery = z.infer<typeof adminRiderQuerySchema>;
export type CreateRiderInput = z.infer<typeof createRiderSchema>;
export type UpdateRiderInput = z.infer<typeof updateRiderSchema>;

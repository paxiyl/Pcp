import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid customer id");

export const adminCustomerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(80).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  sort: z.enum(["joined", "orders", "spend"]).default("joined"),
});

/** The only thing an admin may change about a customer account. */
export const updateCustomerSchema = z.object({ isActive: z.boolean() });

export const customerIdParamSchema = z.object({ customerId: objectId });

export type AdminCustomerQuery = z.infer<typeof adminCustomerQuerySchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

import { z } from "zod";

/** Money arrives in minor units (cents) so nothing is ever a float. */
const amount = z.number().int().min(0).max(100_000);

export const settingsSchema = z
  .object({
    driverBasePay: amount.optional(),
    driverPayPerKm: amount.optional(),
    // A rate, not an amount: 0.25 is 25%. Capped so a typo cannot take half.
    restaurantCommissionRate: z.number().min(0).max(0.5).optional(),
    // Also a rate. Capped low: this one is charged to the customer.
    serviceFeeRate: z.number().min(0).max(0.2).optional(),
    // Cash on delivery policy. The rider carries this money, so the ceiling is
    // an operational limit, not a pricing one.
    codEnabled: z.boolean().optional(),
    codMaxOrderValue: z.number().int().min(0).optional(),
    codMaxOpenOrders: z.number().int().min(0).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one setting to update",
  });

export type SettingsInput = z.infer<typeof settingsSchema>;

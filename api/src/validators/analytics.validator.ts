import { z } from "zod";

export const overviewSchema = z.object({
  // The chart offers 7, 30 and 90 days; anything else is not a real range.
  days: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value)).default(7),
});

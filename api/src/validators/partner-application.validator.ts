import { z } from "zod";

import { PARTNER_ROLES } from "../models/partner-application.model";

export const applicationIdSchema = z.object({
  applicationId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});

export const partnerApplicationSchema = z.object({
  requestedRole: z.enum(PARTNER_ROLES),
  businessName: z.string().trim().min(2, "Enter the name").max(80).optional(),
  area: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(7, "Enter a phone number we can reach you on").max(32),
  vehicle: z.string().trim().min(2).max(60).optional(),
  note: z.string().trim().max(500).optional(),
});

export const applicationReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(300).optional(),
});

export const applicationQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export type PartnerApplicationInput = z.infer<typeof partnerApplicationSchema>;
export type ApplicationReviewInput = z.infer<typeof applicationReviewSchema>;

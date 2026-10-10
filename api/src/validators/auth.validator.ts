import { z } from "zod";

import { PARTNER_ROLES } from "../models/partner-application.model";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(128),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(32).optional(),
  /**
   * What they are signing up to BE.
   *
   * Still never a grant — the account created is always a customer, and this
   * files an application for an admin to decide on. But it has to arrive WITH
   * the registration: the app used to send it in a second request, so a
   * failure there left someone an ordinary customer with no application and no
   * sign anything had gone wrong. Which is exactly the "I signed up as a
   * kitchen and it logged me in as a customer" report.
   */
  joinAs: z.enum(PARTNER_ROLES).optional(),
  /** Required when `joinAs` is a shop or a kitchen. */
  businessName: z.string().trim().min(2, "Enter the name").max(80).optional(),
  area: z.string().trim().min(2).max(80).optional(),
  vehicle: z.string().trim().min(2).max(60).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  /**
   * Which experience the person picked at sign-in.
   *
   * This is a HINT, never a grant. The server compares it with the role stored
   * on the account and refuses a mismatch; it never sets a role from it. A
   * picker that could hand out a role would be an authorisation hole with a
   * dropdown in front of it.
   *
   * "admin" is deliberately not accepted: admins sign in on the backoffice.
   */
  intendedRole: z.enum(["customer", "driver", "store_owner", "restaurant_owner"]).optional(),
});

/**
 * The ID token the client already got from Google. `intendedRole` carries the
 * same meaning as on login: a hint the server checks against the stored role,
 * never a grant.
 */
export const googleSignInSchema = z.object({
  idToken: z.string().min(1, "Missing Google token"),
  intendedRole: z.enum(["customer", "driver", "store_owner", "restaurant_owner"]).optional(),
});

export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** An FCM device token, registered after the customer accepts notifications. */
export const pushTokenSchema = z.object({
  token: z.string().trim().min(10, "Invalid device token").max(4096),
});

export type PushTokenInput = z.infer<typeof pushTokenSchema>;

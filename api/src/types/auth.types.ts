/** Inputs and results for registration and login. */

import { z } from "zod";

import { UserAddressDocument } from "../models/user-address.model";
import { PartnerApplicationDocument } from "../models/partner-application.model";
import { UserDocument } from "../models/user.model";
import { loginSchema, registerSchema } from "../validators/auth.validator";

/**
 * Derived from the validators rather than restated beside them.
 *
 * These were hand-written copies, and they had already drifted: the controller
 * parses login with a schema carrying `intendedRole`, but this type had never
 * grown the field, so the role check in auth.service read as impossible. Infer
 * them and the schema stays the single source of truth.
 */
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type AuthResult = {
  user: UserDocument;
  accessToken: string;
  /** Lets the client route to the address step instead of the home feed. */
  hasAddress: boolean;
  /** Rendered straight into the home header, so no extra request on launch. */
  defaultAddress: UserAddressDocument | null;
  /**
   * Present when they signed up to be a shop, a kitchen or a rider. The
   * account is still a customer — this is the request an admin will decide on.
   *
   * Returned here so the app can land them on "we have your application"
   * instead of the customer home, which is what made signing up as a kitchen
   * look like it had silently ignored the choice.
   */
  application?: PartnerApplicationDocument;
};

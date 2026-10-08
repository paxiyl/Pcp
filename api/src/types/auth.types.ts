/** Inputs and results for registration and login. */

import { UserAddressDocument } from "../models/user-address.model";
import { UserDocument } from "../models/user.model";

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthResult = {
  user: UserDocument;
  accessToken: string;
  /** Lets the client route to the address step instead of the home feed. */
  hasAddress: boolean;
  /** Rendered straight into the home header, so no extra request on launch. */
  defaultAddress: UserAddressDocument | null;
};

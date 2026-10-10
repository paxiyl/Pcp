import { UserAddressDocument } from "../models/user-address.model";
import { verifyGoogleIdToken } from "../config/google.config";
import { UserDocument, UserModel } from "../models/user.model";
import { AuthResult, LoginInput, RegisterInput } from "../types/auth.types";
import { GoogleSignInInput } from "../validators/auth.validator";
import { BadRequestException, UnauthorizedException } from "../utils/app-error";
import { signAccessToken } from "../utils/jwt";
import { findDefaultAddress } from "./address.service";
import { applyToBePartner } from "./partner-application.service";
import { findUserByEmail, findUserByEmailWithPassword } from "./user.service";

const issueToken = (user: UserDocument) =>
  signAccessToken({ role: user.role, userId: user._id.toString() });

export const registerUser = async (input: RegisterInput): Promise<AuthResult> => {
  const existing = await findUserByEmail(input.email);

  if (existing) {
    throw new BadRequestException("An account with this email already exists");
  }

  // A shop or a kitchen is identified by its name, so refuse BEFORE creating
  // the account rather than after. Creating it first and then rejecting the
  // application is how someone ends up an ordinary customer who thinks they
  // signed up as a kitchen.
  if (input.joinAs && input.joinAs !== "driver" && !input.businessName) {
    throw new BadRequestException("Tell us the name of your shop or kitchen");
  }

  if (input.joinAs && !input.phone) {
    throw new BadRequestException("We need a phone number to reach you about your application");
  }

  // Only ever a customer here. A role is granted by an admin approving the
  // application below, never by asking for it at sign-up.
  const user = await UserModel.create({
    email: input.email.toLowerCase(),
    name: input.name,
    password: input.password,
    phone: input.phone,
    role: "customer",
  });

  const application = input.joinAs
    ? await applyToBePartner(user, {
        area: input.area,
        businessName: input.businessName,
        phone: input.phone as string,
        requestedRole: input.joinAs,
        vehicle: input.vehicle,
      })
    : undefined;

  // A brand new account cannot have an address yet.
  return {
    accessToken: issueToken(user),
    application,
    defaultAddress: null,
    hasAddress: false,
    user,
  };
};

/** How a role is named to the person, rather than how it is stored. */
const ROLE_LABELS: Record<string, string> = {
  customer: "customer",
  driver: "delivery partner",
  restaurant_owner: "restaurant owner",
  store_owner: "store owner",
};

export const loginUser = async (input: LoginInput): Promise<AuthResult> => {
  const user = await findUserByEmailWithPassword(input.email);

  // One message for "no such user" and "wrong password" so accounts cannot be enumerated.
  const invalidCredentials = new UnauthorizedException("Invalid email or password");

  if (!user) throw invalidCredentials;

  const passwordMatches = await user.comparePassword(input.password);

  if (!passwordMatches) throw invalidCredentials;
  if (!user.isActive) throw new UnauthorizedException("This account has been deactivated");

  // Checked AFTER the password, so a wrong guess at the role cannot be used to
  // probe which accounts exist or what they are.
  //
  // `intendedRole` is also what tells the two callers apart: the app always
  // sends the experience the person picked, the backoffice never does. An
  // admin reaching here without one is signing in to the backoffice, which is
  // exactly where they belong — refusing them unconditionally, as this did,
  // locked admins out of the backoffice entirely.
  if (input.intendedRole && user.role === "admin") {
    throw new UnauthorizedException(
      "Admin accounts sign in on the Raket backoffice, not the app.",
    );
  }

  if (input.intendedRole && input.intendedRole !== user.role) {
    throw new UnauthorizedException(
      `This account is not registered as a ${ROLE_LABELS[input.intendedRole]}.`,
    );
  }

  const defaultAddress = await findDefaultAddress(user._id.toString());

  return {
    accessToken: issueToken(user),
    defaultAddress,
    hasAddress: defaultAddress !== null,
    user,
  };
};

/**
 * Signing in with a Google ID token the client already holds.
 *
 * Matching is by Google's `sub`, not the email: an address can be reassigned
 * inside a workspace, a subject id cannot. An existing password account with
 * the same verified address is LINKED rather than duplicated — Google has
 * already proved the person owns it, so refusing would strand them with two
 * accounts and no way to merge.
 *
 * A brand new Google account is always a customer. Staff roles are granted
 * deliberately in the backoffice; signing in must never be able to mint one.
 */
export const signInWithGoogle = async (input: GoogleSignInInput): Promise<AuthResult> => {
  const payload = await verifyGoogleIdToken(input.idToken);

  if (!payload.email || !payload.email_verified) {
    throw new UnauthorizedException("This Google account has no verified email address");
  }

  const email = payload.email.toLowerCase();
  let user = await UserModel.findOne({ googleId: payload.sub }).exec();

  if (!user) {
    const existing = await UserModel.findOne({ email }).exec();

    if (existing) {
      existing.googleId = payload.sub;
      await existing.save();
      user = existing;
    } else {
      user = await UserModel.create({
        email,
        googleId: payload.sub,
        name: payload.name ?? email.split("@")[0],
        role: "customer",
      });
    }
  }

  if (!user.isActive) throw new UnauthorizedException("This account has been deactivated");

  // Same two guards as a password login, and for the same reasons.
  if (input.intendedRole && user.role === "admin") {
    throw new UnauthorizedException(
      "Admin accounts sign in on the Raket backoffice, not the app.",
    );
  }

  if (input.intendedRole && input.intendedRole !== user.role) {
    throw new UnauthorizedException(
      `This account is not registered as a ${ROLE_LABELS[input.intendedRole]}.`,
    );
  }

  const defaultAddress = await findDefaultAddress(user._id.toString());

  return {
    accessToken: issueToken(user),
    defaultAddress,
    hasAddress: defaultAddress !== null,
    user,
  };
};

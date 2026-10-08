import { UserAddressDocument } from "../models/user-address.model";
import { UserDocument, UserModel } from "../models/user.model";
import { AuthResult, LoginInput, RegisterInput } from "../types/auth.types";
import { BadRequestException, UnauthorizedException } from "../utils/app-error";
import { signAccessToken } from "../utils/jwt";
import { findDefaultAddress } from "./address.service";
import { findUserByEmail, findUserByEmailWithPassword } from "./user.service";

const issueToken = (user: UserDocument) =>
  signAccessToken({ role: user.role, userId: user._id.toString() });

export const registerUser = async (input: RegisterInput): Promise<AuthResult> => {
  const existing = await findUserByEmail(input.email);

  if (existing) {
    throw new BadRequestException("An account with this email already exists");
  }

  // Only ever a customer here; drivers and admins are created in the backoffice.
  const user = await UserModel.create({
    email: input.email.toLowerCase(),
    name: input.name,
    password: input.password,
    phone: input.phone,
    role: "customer",
  });

  // A brand new account cannot have an address yet.
  return { accessToken: issueToken(user), defaultAddress: null, hasAddress: false, user };
};

/** How a role is named to the person, rather than how it is stored. */
const ROLE_LABELS: Record<string, string> = {
  customer: "customer",
  driver: "delivery partner",
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
  if (input.intendedRole && input.intendedRole !== user.role) {
    throw new UnauthorizedException(
      `This account is not registered as a ${ROLE_LABELS[input.intendedRole]}.`,
    );
  }

  if (user.role === "admin") {
    throw new UnauthorizedException(
      "Admin accounts sign in on the OnlineMall backoffice, not the app.",
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

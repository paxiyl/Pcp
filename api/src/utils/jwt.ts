import jwt, { SignOptions } from "jsonwebtoken";

import { Env } from "../config/env.config";

export type AccessTokenPayload = {
  userId: string;
  role: string;
};

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, Env.JWT_SECRET, {
    expiresIn: Env.JWT_EXPIRES_IN,
  } as SignOptions);

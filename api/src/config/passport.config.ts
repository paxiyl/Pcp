import { Request } from "express";
import passport from "passport";
import { ExtractJwt, Strategy as JwtStrategy, StrategyOptionsWithoutRequest } from "passport-jwt";

import { findUserById } from "../services/user.service";
import { ACCESS_TOKEN_COOKIE } from "../utils/cookie";
import { AccessTokenPayload } from "../utils/jwt";
import { Env } from "./env.config";

/** Admin web sends the token in an HTTP-only cookie. */
const cookieExtractor = (req: Request) => req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;

const options: StrategyOptionsWithoutRequest = {
  // Mobile sends `Authorization: Bearer <token>` from expo-secure-store.
  jwtFromRequest: ExtractJwt.fromExtractors([
    cookieExtractor,
    ExtractJwt.fromAuthHeaderAsBearerToken(),
  ]),
  secretOrKey: Env.JWT_SECRET,
};

export const configurePassport = (): void => {
  passport.use(
    new JwtStrategy(options, async (payload: AccessTokenPayload, done) => {
      try {
        const user = await findUserById(payload.userId);

        if (!user || !user.isActive) return done(null, false);

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }),
  );
};

export { passport };

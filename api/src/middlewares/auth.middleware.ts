import { NextFunction, Request, RequestHandler, Response } from "express";
import passport from "passport";

import { UserDocument, UserRole } from "../models/user.model";
import { ForbiddenException, UnauthorizedException } from "../utils/app-error";

/** Verifies the JWT from either transport and puts the user on the request. */
export const requireAuth: RequestHandler = (request, response, next) => {
  passport.authenticate(
    "jwt",
    { session: false },
    (error: unknown, user: UserDocument | false) => {
      if (error) return next(error);
      if (!user) return next(new UnauthorizedException("You are not logged in"));

      request.user = user;

      return next();
    },
  )(request, response, next);
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (request: Request, _response: Response, next: NextFunction) => {
    const user = request.user as UserDocument | undefined;

    if (!user) return next(new UnauthorizedException("You are not logged in"));
    if (!roles.includes(user.role)) {
      return next(new ForbiddenException("You do not have access to this resource"));
    }

    return next();
  };

import { CookieOptions, Response } from "express";

import { Env } from "../config/env.config";

export const ACCESS_TOKEN_COOKIE = "accessToken";

const isProduction = Env.NODE_ENV === "production";

/**
 * Admin (browser) transport. Mobile clients ignore this and send the same token
 * as an Authorization header instead.
 */
const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  path: "/",
  // The API serves the admin build in production, so the cookie is same-origin
  // and does not need the third-party "none" mode browsers are phasing out.
  sameSite: "lax",
  secure: isProduction,
};

export const setJwtAuthCookie = (response: Response, token: string): void => {
  response.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearJwtAuthCookie = (response: Response): void => {
  response.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOptions);
};

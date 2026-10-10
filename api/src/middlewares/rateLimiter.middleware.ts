import { rateLimit } from "express-rate-limit";

import { ErrorCodes } from "../utils/app-error";

const tooMany = (message: string) => ({
  success: false,
  errorCode: ErrorCodes.ERR_TOO_MANY_REQUESTS,
  message,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many requests. Try again in a few minutes."),
});

/**
 * Brute-force protection for PASSWORD LOGIN, and nothing else.
 *
 * Only failures count — `skipSuccessfulRequests` — because the thing being
 * limited is guessing. Someone signing in correctly forty times is not an
 * attack; someone failing ten times probably is.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: tooMany(
    "Too many failed sign-in attempts. Wait 15 minutes, or reset your password.",
  ),
});

/**
 * Registration is the mirror image: it counts SUCCESSES.
 *
 * The abuse worth stopping here is bulk account creation, and the only request
 * that creates an account is one that succeeds. A failure on this endpoint is
 * almost always a person getting something wrong — most often "an account with
 * this email already exists", which is exactly what someone retrying their own
 * sign-up hits.
 *
 * Counting those failures, which is what this endpoint used to do while
 * sharing a ten-per-fifteen-minutes budget with login, meant ten honest
 * retries locked you out with "Too many requests" — an error that says nothing
 * about the duplicate email that actually caused it, and sends you looking for
 * a problem that is not there.
 *
 * The ceiling is per IP and deliberately generous: on Indian mobile networks a
 * whole town can share one address behind CGNAT, so a tight limit here would
 * lock out a neighbourhood because one person signed up twice.
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipFailedRequests: true,
  message: tooMany(
    "A lot of accounts have been created from this network in the last hour. Try again later.",
  ),
});

/**
 * Google sign-in. An ID token is a credential, so failures count here as they
 * do on a password login — but the budget is separate, because being locked
 * out of one should never lock you out of the other.
 */
export const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: tooMany("Too many failed Google sign-in attempts. Try again in 15 minutes."),
});

import { rateLimit } from "express-rate-limit";

import { ErrorCodes } from "../utils/app-error";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: ErrorCodes.ERR_TOO_MANY_REQUESTS,
    message: "Too many requests. Try again later.",
  },
});

/** Credential endpoints get a tighter budget than ordinary API traffic. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    errorCode: ErrorCodes.ERR_TOO_MANY_REQUESTS,
    message: "Too many attempts. Try again later.",
  },
});

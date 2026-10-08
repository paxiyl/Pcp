import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { Env } from "../config/env.config";
import { HTTPSTATUS } from "../config/http-status.config";
import { AppError, ErrorCodes } from "../utils/app-error";
import { logger } from "../utils/logger";

const formatZodError = (error: ZodError) =>
  error.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }));

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const route = `${request.method} ${request.originalUrl}`;

  if (error instanceof ZodError) {
    logger.warn("Validation failed", { route, statusCode: HTTPSTATUS.BAD_REQUEST });

    return response.status(HTTPSTATUS.BAD_REQUEST).json({
      success: false,
      errorCode: ErrorCodes.ERR_VALIDATION,
      message: "Validation failed",
      errors: formatZodError(error),
    });
  }

  if (error instanceof AppError) {
    logger.warn(error.message, { route, statusCode: error.statusCode, errorCode: error.errorCode });

    return response.status(error.statusCode).json({
      success: false,
      errorCode: error.errorCode,
      message: error.message,
    });
  }

  if (error instanceof SyntaxError && "body" in error) {
    logger.warn("Malformed JSON body", { route, statusCode: HTTPSTATUS.BAD_REQUEST });

    return response.status(HTTPSTATUS.BAD_REQUEST).json({
      success: false,
      errorCode: ErrorCodes.ERR_BAD_REQUEST,
      message: "Invalid JSON payload",
    });
  }

  logger.error("Unhandled error", {
    route,
    statusCode: HTTPSTATUS.INTERNAL_SERVER_ERROR,
    error: error instanceof Error ? error.message : "Unknown error",
    stack: Env.NODE_ENV === "production" ? undefined : (error as Error)?.stack,
  });

  return response.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    errorCode: ErrorCodes.ERR_INTERNAL,
    message: "Internal server error",
  });
};

import { HTTPSTATUS, HttpStatusCodeType } from "../config/http-status.config";

export const ErrorCodes = {
  ERR_INTERNAL: "ERR_INTERNAL",
  ERR_BAD_REQUEST: "ERR_BAD_REQUEST",
  ERR_UNAUTHORIZED: "ERR_UNAUTHORIZED",
  ERR_FORBIDDEN: "ERR_FORBIDDEN",
  ERR_NOT_FOUND: "ERR_NOT_FOUND",
  ERR_VALIDATION: "ERR_VALIDATION",
  ERR_TOO_MANY_REQUESTS: "ERR_TOO_MANY_REQUESTS",
} as const;

export type ErrorCodeType = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class AppError extends Error {
  public readonly statusCode: HttpStatusCodeType;
  public readonly errorCode: ErrorCodeType;

  constructor(
    message: string,
    statusCode: HttpStatusCodeType = HTTPSTATUS.INTERNAL_SERVER_ERROR,
    errorCode: ErrorCodeType = ErrorCodes.ERR_INTERNAL,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, new.target);
  }
}

export class InternalServerException extends AppError {
  constructor(message = "Internal server error", errorCode: ErrorCodeType = ErrorCodes.ERR_INTERNAL) {
    super(message, HTTPSTATUS.INTERNAL_SERVER_ERROR, errorCode);
  }
}

export class NotFoundException extends AppError {
  constructor(message = "Resource not found", errorCode: ErrorCodeType = ErrorCodes.ERR_NOT_FOUND) {
    super(message, HTTPSTATUS.NOT_FOUND, errorCode);
  }
}

export class BadRequestException extends AppError {
  constructor(message = "Bad request", errorCode: ErrorCodeType = ErrorCodes.ERR_BAD_REQUEST) {
    super(message, HTTPSTATUS.BAD_REQUEST, errorCode);
  }
}

export class UnauthorizedException extends AppError {
  constructor(message = "Unauthorized", errorCode: ErrorCodeType = ErrorCodes.ERR_UNAUTHORIZED) {
    super(message, HTTPSTATUS.UNAUTHORIZED, errorCode);
  }
}

export class ForbiddenException extends AppError {
  constructor(message = "Forbidden", errorCode: ErrorCodeType = ErrorCodes.ERR_FORBIDDEN) {
    super(message, HTTPSTATUS.FORBIDDEN, errorCode);
  }
}

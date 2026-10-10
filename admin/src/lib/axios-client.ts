import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";

/**
 * Set VITE_API_URL in admin/.env to point at a different host. Leave it unset in
 * production: the API serves this build, so a relative path keeps the auth
 * cookie same-origin.
 */
const baseURL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api/v1" : "http://localhost:8000/api/v1");

/** The shape the API's error handler returns for every failure. */
export type ApiErrorBody = {
  success: false;
  errorCode: string;
  message: string;
  errors?: { field: string; message: string }[];
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly errorCode: string;
  public readonly fieldErrors: { field: string; message: string }[];

  constructor(
    message: string,
    status: number,
    errorCode: string,
    fieldErrors: ApiError["fieldErrors"] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.fieldErrors = fieldErrors;
  }
}

export const API: AxiosInstance = axios.create({
  baseURL,
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
  // Admin uses the HTTP-only cookie transport, so the token never touches JS.
  withCredentials: true,
});

API.interceptors.response.use(
  // Callers receive the parsed body directly, so no `.data.data` chains upstream.
  (response) => response.data,
  (error: AxiosError<ApiErrorBody>) => {
    const body = error.response?.data;
    const status = error.response?.status ?? 0;

    if (!error.response) {
      throw new ApiError(
        "Can't reach the Raket API. Check that it is running and try again.",
        0,
        "ERR_NETWORK",
      );
    }

    throw new ApiError(
      body?.message ?? "Something went wrong. Please try again.",
      status,
      body?.errorCode ?? "ERR_INTERNAL",
      body?.errors ?? [],
    );
  },
);

/**
 * The message to show for a thrown error.
 *
 * Exists because `catch (error)` gives `unknown`, and every call site writing
 * its own `instanceof` narrowing is both repetitive and easy to get subtly
 * wrong. The fallback is always supplied by the caller, so a customer never
 * reads a raw exception.
 */
export const apiMessage = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? (error as ApiError).message : fallback;

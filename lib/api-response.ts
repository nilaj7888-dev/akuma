import { NextResponse } from "next/server";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccess<T = unknown> {
  data: T;
}

/**
 * Create a successful API response
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, { status });
}

/**
 * Create an error API response
 */
export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse<{ error: ApiError }> {
  const error: ApiError = { code, message };
  if (details) {
    error.details = details;
  }
  return NextResponse.json({ error }, { status });
}

/**
 * Common error responses
 */
export const ApiErrors = {
  unauthorized: () => apiError("UNAUTHORIZED", "Sign in required.", 401),
  forbidden: (message = "Access denied.") => apiError("FORBIDDEN", message, 403),
  notFound: (resource = "Resource") => apiError("NOT_FOUND", `${resource} not found.`, 404),
  validation: (message = "Invalid request data.") => apiError("VALIDATION_ERROR", message, 400),
  database: () => apiError("DATABASE_UNAVAILABLE", "Database connection required.", 503),
  internal: (message = "An unexpected error occurred.") => apiError("INTERNAL_ERROR", message, 500),
};

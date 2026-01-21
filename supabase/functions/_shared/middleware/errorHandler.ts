import { errorResponse } from "../utils/response.ts";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Permission denied") {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, "CONFLICT_ERROR", details);
    this.name = "ConflictError";
  }
}

export function handleError(error: unknown): Response {
  console.error("Error occurred:", error);

  if (error instanceof AppError) {
    return errorResponse(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      error.statusCode
    );
  }

  if (error instanceof Error) {
    return errorResponse(error.message, 500);
  }

  return errorResponse("An unexpected error occurred", 500);
}

export async function withErrorHandling(
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return handleError(error);
  }
}
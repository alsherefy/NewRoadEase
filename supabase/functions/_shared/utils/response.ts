import { ApiResponse, ErrorResponse } from "../types/api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export function corsResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export function successResponse<T>(data: T, status: number = 200): Response {
  const response: ApiResponse<T> = {
    data,
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(
  error: string | Error | ErrorResponse,
  status: number = 500,
  details?: Record<string, unknown>
): Response {
  let errorMessage: string;
  let errorCode: string | undefined;
  let errorDetails: Record<string, unknown> | undefined;

  if (typeof error === "string") {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorCode = error.name;
  } else {
    errorMessage = error.error || "An unexpected error occurred";
    errorCode = error.code;
    errorDetails = error.details;
  }

  const response: ApiResponse = {
    error: errorMessage,
    message: errorCode,
  };

  if (details || errorDetails) {
    (response as ErrorResponse).details = details || errorDetails;
  }

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export { corsHeaders };
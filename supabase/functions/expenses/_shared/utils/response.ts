import { ApiResponse, ApiError } from "../types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "X-API-Version": "1.0",
};

export function successResponse<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    error: null,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(
  error: ApiError | Error,
  status?: number
): Response {
  let body: ApiResponse;

  if (error instanceof ApiError) {
    body = {
      success: false,
      data: null,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
    status = error.status;
  } else {
    body = {
      success: false,
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        details: Deno.env.get("ENV") === "development" ? error.message : undefined,
      },
    };
    status = status || 500;
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function corsResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}
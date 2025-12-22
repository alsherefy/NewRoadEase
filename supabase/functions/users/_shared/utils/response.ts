import { ApiResponse, ApiError } from "../types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export function successResponse<T>(
  data: T,
  status: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    error: null,
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

export function errorResponse(
  error: unknown,
  status?: number
): Response {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof Error) {
    apiError = new ApiError(error.message);
  } else {
    apiError = new ApiError("An unknown error occurred");
  }

  const response: ApiResponse = {
    success: false,
    data: null,
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
    },
  };

  return new Response(JSON.stringify(response), {
    status: status || apiError.status || 500,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

export function corsResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}
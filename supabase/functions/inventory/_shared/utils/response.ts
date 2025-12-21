import { ApiResponse } from "../_shared/types.ts";

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
    success: true,
    data,
    error: null,
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(error: any, status?: number): Response {
  const errorStatus = status || error.status || 500;
  const errorCode = error.code || "ERROR";
  const errorMessage = error.message || "An unexpected error occurred";
  const errorDetails = error.details || null;

  const response: ApiResponse = {
    success: false,
    data: null,
    error: {
      code: errorCode,
      message: errorMessage,
      details: errorDetails,
    },
  };

  return new Response(JSON.stringify(response), {
    status: errorStatus,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const supabase = getAuthenticatedClient(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const settingsId = pathParts[2];

    switch (req.method) {
      case "GET": {
        const { data, error } = await supabase
          .from("workshop_settings")
          .select("*")
          .maybeSingle();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "POST": {
        const body = await req.json();
        const { data, error } = await supabase
          .from("workshop_settings")
          .insert(body)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data, 201);
      }

      case "PUT": {
        if (!settingsId) throw new ApiError("Settings ID required", "VALIDATION_ERROR", 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from("workshop_settings")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", settingsId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    console.error("Error in settings endpoint:", err);
    return errorResponse(err as Error);
  }
});

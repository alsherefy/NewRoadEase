import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseClient } from "./_shared/utils/supabase.ts";
import { authenticateRequest } from "./_shared/middleware/auth.ts";
import { successResponse, errorResponse, corsResponse } from "./_shared/utils/response.ts";
import { ApiError } from "./_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const auth = await authenticateRequest(req);
    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const lastPart = pathParts[pathParts.length - 1];
    const settingsId = lastPart !== 'settings' ? lastPart : undefined;

    switch (req.method) {
      case "GET": {
        const { data, error } = await supabase
          .from("workshop_settings")
          .select("*")
          .eq("organization_id", auth.organizationId)
          .maybeSingle();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "POST": {
        const body = await req.json();
        const { data, error } = await supabase
          .from("workshop_settings")
          .insert({
            ...body,
            organization_id: auth.organizationId,
          })
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
          .eq("organization_id", auth.organizationId)
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
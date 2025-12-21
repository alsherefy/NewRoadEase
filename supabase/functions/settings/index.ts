import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { allRoles, adminOnly } from "../_shared/middleware/authorize.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { validateUUID } from "../_shared/utils/validation.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const auth = await authenticateRequest(req);
    const supabase = getAuthenticatedClient(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const lastPart = pathParts[pathParts.length - 1];
    const settingsId = lastPart !== 'settings' ? lastPart : undefined;

    switch (req.method) {
      case "GET": {
        allRoles(auth);

        const { data, error } = await supabase
          .from("workshop_settings")
          .select("*")
          .eq("organization_id", auth.organizationId)
          .maybeSingle();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "POST": {
        adminOnly(auth);

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
        adminOnly(auth);
        validateUUID(settingsId, "Settings ID");

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
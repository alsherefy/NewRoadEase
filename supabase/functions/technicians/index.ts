import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseClient } from "../_shared/utils/supabase.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { ApiError } from "../_shared/types.ts";

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
    const technicianId = lastPart !== 'technicians' ? lastPart : undefined;
    const activeOnly = url.searchParams.get("activeOnly") === "true";

    switch (req.method) {
      case "GET": {
        if (technicianId) {
          const { data, error } = await supabase
            .from("technicians")
            .select("*")
            .eq("id", technicianId)
            .eq("organization_id", auth.organizationId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DB_ERROR", 500);
          if (!data) throw new ApiError("Technician not found", "NOT_FOUND", 404);
          return successResponse(data);
        }

        let query = supabase.from("technicians").select("*").eq("organization_id", auth.organizationId);

        if (activeOnly) {
          query = query.eq("is_active", true);
        }

        const orderBy = url.searchParams.get("orderBy") || "name";
        const orderDir = url.searchParams.get("orderDir") || "asc";

        const { data, error } = await query.order(orderBy, { ascending: orderDir === "asc" });

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        const body = await req.json();
        const { data, error } = await supabase
          .from("technicians")
          .insert({
            ...body,
            organization_id: auth.organizationId,
          })
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        return successResponse(data, 201);
      }

      case "PUT": {
        if (!technicianId) throw new ApiError("Technician ID required", "INVALID_REQUEST", 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from("technicians")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", technicianId)
          .eq("organization_id", auth.organizationId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        return successResponse(data);
      }

      case "DELETE": {
        if (!technicianId) throw new ApiError("Technician ID required", "INVALID_REQUEST", 400);

        const { error } = await supabase
          .from("technicians")
          .delete()
          .eq("id", technicianId)
          .eq("organization_id", auth.organizationId);

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        return successResponse({ success: true });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
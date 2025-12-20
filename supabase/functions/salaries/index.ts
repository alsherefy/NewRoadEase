import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
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
    const salaryId = lastPart !== 'salaries' ? lastPart : undefined;
    const technicianId = url.searchParams.get("technicianId");

    switch (req.method) {
      case "GET": {
        if (salaryId) {
          const { data, error } = await supabase
            .from("salaries")
            .select(`*, technician:technicians(*)`)
            .eq("id", salaryId)
            .eq("organization_id", auth.organizationId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          if (!data) throw new ApiError("Salary not found", "NOT_FOUND", 404);
          return successResponse(data);
        }

        let query = supabase.from("salaries").select(`*, technician:technicians(*)`).eq("organization_id", auth.organizationId);

        if (technicianId) {
          query = query.eq("technician_id", technicianId);
        }

        const orderBy = url.searchParams.get("orderBy") || "created_at";
        const orderDir = url.searchParams.get("orderDir") || "desc";

        const { data, error } = await query.order(orderBy, { ascending: orderDir === "asc" });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        const body = await req.json();
        const { data: salaryNumber } = await supabase.rpc("generate_salary_number");

        const { data, error } = await supabase
          .from("salaries")
          .insert({
            ...body,
            salary_number: salaryNumber,
            organization_id: auth.organizationId,
          })
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data, 201);
      }

      case "PUT": {
        if (!salaryId) throw new ApiError("Salary ID required", "VALIDATION_ERROR", 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from("salaries")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", salaryId)
          .eq("organization_id", auth.organizationId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "DELETE": {
        if (!salaryId) throw new ApiError("Salary ID required", "VALIDATION_ERROR", 400);

        const { error } = await supabase
          .from("salaries")
          .delete()
          .eq("id", salaryId)
          .eq("organization_id", auth.organizationId);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({ success: true });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    console.error("Error in salaries endpoint:", err);
    return errorResponse(err as Error);
  }
});

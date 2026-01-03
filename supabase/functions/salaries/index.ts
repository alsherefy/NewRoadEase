import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateWithPermissions } from "../_shared/middleware/authWithPermissions.ts";
import { requirePermission } from "../_shared/middleware/permissionChecker.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { validateUUID, validateRequestBody } from "../_shared/utils/validation.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const auth = await authenticateWithPermissions(req);
    const supabase = getAuthenticatedClient(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const lastPart = pathParts[pathParts.length - 1];
    const action = lastPart === 'calculate' ? 'calculate' : undefined;
    const salaryId = lastPart !== 'salaries' && action !== 'calculate' ? lastPart : undefined;
    const technicianId = url.searchParams.get("technicianId");

    switch (req.method) {
      case "GET": {
        requirePermission(auth, 'salaries.view');

        if (action === 'calculate') {
          const calcTechnicianId = url.searchParams.get("technicianId");
          const month = url.searchParams.get("month");
          const year = url.searchParams.get("year");

          if (!calcTechnicianId || !month || !year) {
            throw new ApiError("Missing required parameters: technicianId, month, year", "VALIDATION_ERROR", 400);
          }

          const { data, error } = await supabase.rpc('calculate_technician_salary', {
            p_technician_id: calcTechnicianId,
            p_month: parseInt(month),
            p_year: parseInt(year)
          });

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          return successResponse(data);
        }

        if (salaryId) {
          validateUUID(salaryId, "Salary ID");

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

        const month = url.searchParams.get("month");
        if (month) {
          query = query.eq("month", parseInt(month));
        }

        const year = url.searchParams.get("year");
        if (year) {
          query = query.eq("year", parseInt(year));
        }

        const paymentStatus = url.searchParams.get("payment_status");
        if (paymentStatus && paymentStatus !== 'all') {
          query = query.eq("payment_status", paymentStatus);
        }

        const orderBy = url.searchParams.get("orderBy") || "created_at";
        const orderDir = url.searchParams.get("orderDir") || "desc";

        const { data, error } = await query.order(orderBy, { ascending: orderDir === "asc" });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        requirePermission(auth, 'salaries.create');

        const body = await req.json();
        const { data: salaryNumber } = await supabase.rpc("generate_salary_number");

        const { data, error } = await supabase
          .from("salaries")
          .insert({
            ...body,
            salary_number: salaryNumber,
            organization_id: auth.organizationId,
          })
          .select(`*, technician:technicians(*)`)
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data, 201);
      }

      case "PUT": {
        requirePermission(auth, 'salaries.update');
        validateUUID(salaryId, "Salary ID");

        const body = await req.json();
        const { data, error } = await supabase
          .from("salaries")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", salaryId)
          .eq("organization_id", auth.organizationId)
          .select(`*, technician:technicians(*)`)
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "DELETE": {
        requirePermission(auth, 'salaries.delete');
        validateUUID(salaryId, "Salary ID");

        const { error } = await supabase
          .from("salaries")
          .delete()
          .eq("id", salaryId)
          .eq("organization_id", auth.organizationId);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({ deleted: true });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    return errorResponse(err as Error);
  }
});
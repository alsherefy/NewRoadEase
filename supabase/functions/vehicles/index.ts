import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { allRoles, adminAndCustomerService, adminOnly, checkOwnership } from "../_shared/middleware/authorize.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { validateUUID, validateRequestBody } from "../_shared/utils/validation.ts";
import { RESOURCES } from "../_shared/constants/resources.ts";
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
    const vehicleId = lastPart !== 'vehicles' ? lastPart : undefined;
    const customerId = url.searchParams.get("customerId");

    switch (req.method) {
      case "GET": {
        allRoles(auth);

        if (vehicleId) {
          validateUUID(vehicleId, "Vehicle ID");

          const { data, error } = await supabase
            .from("vehicles")
            .select("*")
            .eq("id", vehicleId)
            .eq("organization_id", auth.organizationId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          if (!data) throw new ApiError("Vehicle not found", "NOT_FOUND", 404);
          return successResponse(data);
        }

        let query = supabase.from("vehicles").select("*").eq("organization_id", auth.organizationId);

        if (customerId) {
          query = query.eq("customer_id", customerId);
        }

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        adminAndCustomerService(auth);

        const body = await validateRequestBody(req, ["customer_id", "car_make", "car_model", "plate_number"]);
        const { data, error } = await supabase
          .from("vehicles")
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
        adminAndCustomerService(auth);
        validateUUID(vehicleId, "Vehicle ID");

        await checkOwnership(auth, RESOURCES.VEHICLES, vehicleId!);

        const body = await req.json();
        const { data, error } = await supabase
          .from("vehicles")
          .update(body)
          .eq("id", vehicleId)
          .eq("organization_id", auth.organizationId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "DELETE": {
        adminOnly(auth);
        validateUUID(vehicleId, "Vehicle ID");

        await checkOwnership(auth, RESOURCES.VEHICLES, vehicleId!);

        const { error } = await supabase
          .from("vehicles")
          .delete()
          .eq("id", vehicleId)
          .eq("organization_id", auth.organizationId);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({ deleted: true });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    console.error("Error in vehicles endpoint:", err);
    return errorResponse(err as Error);
  }
});

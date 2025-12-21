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
    const sparePartId = lastPart !== 'inventory' ? lastPart : undefined;

    switch (req.method) {
      case "GET": {
        allRoles(auth);

        if (sparePartId) {
          validateUUID(sparePartId, "Spare Part ID");

          const { data, error } = await supabase
            .from("spare_parts")
            .select("*")
            .eq("id", sparePartId)
            .eq("organization_id", auth.organizationId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          if (!data) throw new ApiError("Spare part not found", "NOT_FOUND", 404);
          return successResponse(data);
        }

        const lowStockOnly = url.searchParams.get("lowStockOnly") === "true";
        const orderBy = url.searchParams.get("orderBy") || "name";
        const orderDir = url.searchParams.get("orderDir") || "asc";

        let query = supabase.from("spare_parts").select("*").eq("organization_id", auth.organizationId);

        if (lowStockOnly) {
          const { data: allParts } = await query.order(orderBy, { ascending: orderDir === "asc" });
          const lowStock = (allParts || []).filter(p => p.quantity <= p.minimum_quantity);
          return successResponse(lowStock);
        }

        const { data, error } = await query.order(orderBy, { ascending: orderDir === "asc" });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        adminAndCustomerService(auth);

        const body = await validateRequestBody(req, ["name", "part_number", "quantity", "unit_price"]);
        const { data, error } = await supabase
          .from("spare_parts")
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
        validateUUID(sparePartId, "Spare Part ID");

        await checkOwnership(auth, RESOURCES.INVENTORY, sparePartId!);

        const body = await req.json();
        const { data, error } = await supabase
          .from("spare_parts")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", sparePartId)
          .eq("organization_id", auth.organizationId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "DELETE": {
        adminOnly(auth);
        validateUUID(sparePartId, "Spare Part ID");

        await checkOwnership(auth, RESOURCES.INVENTORY, sparePartId!);

        const { error } = await supabase
          .from("spare_parts")
          .delete()
          .eq("id", sparePartId)
          .eq("organization_id", auth.organizationId);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({ deleted: true });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    console.error("Error in inventory endpoint:", err);
    return errorResponse(err as Error);
  }
});
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateWithPermissions } from "../_shared/middleware/authWithPermissions.ts";
import { requirePermission } from "../_shared/middleware/permissionChecker.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { handleError } from "../_shared/middleware/errorHandler.ts";
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
    const sparePartId = lastPart !== 'inventory' ? lastPart : undefined;

    switch (req.method) {
      case "GET": {
        requirePermission(auth, 'inventory.view');

        if (sparePartId) {
          validateUUID(sparePartId, "Spare Part ID");

          const { data, error } = await supabase
            .from("spare_parts")
            .select("id, part_number, name, description, category, supplier, quantity, minimum_quantity, unit_price, location, created_at, updated_at")
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
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);

        let query = supabase
          .from("spare_parts")
          .select("id, part_number, name, description, category, supplier, quantity, minimum_quantity, unit_price, location, created_at, updated_at")
          .eq("organization_id", auth.organizationId);

        if (lowStockOnly) {
          const { data, error } = await query
            .lte("quantity", "minimum_quantity")
            .order(orderBy, { ascending: orderDir === "asc" })
            .limit(limit);

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          return successResponse(data || []);
        }

        const { data, error } = await query
          .order(orderBy, { ascending: orderDir === "asc" })
          .limit(limit);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        requirePermission(auth, 'inventory.create');

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
        requirePermission(auth, 'inventory.update');
        validateUUID(sparePartId, "Spare Part ID");

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
        requirePermission(auth, 'inventory.delete');
        validateUUID(sparePartId, "Spare Part ID");

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
  } catch (error) {
    return handleError(error);
  }
});
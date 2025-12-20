import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { allRoles } from "../_shared/middleware/authorize.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { getSupabaseClient } from "../_shared/utils/supabase.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const user = await authenticateRequest(req);
    allRoles(user);

    const supabase = getSupabaseClient();

    switch (req.method) {
      case "GET": {
        const { data, error } = await supabase
          .rpc("get_dashboard_stats", { p_organization_id: user.organizationId })
          .maybeSingle();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        if (!data) {
          return successResponse({
            totalRevenue: 0,
            completedOrders: 0,
            activeCustomers: 0,
            activeTechnicians: 0,
          });
        }

        return successResponse({
          totalRevenue: Number(data.total_revenue) || 0,
          completedOrders: Number(data.completed_orders) || 0,
          activeCustomers: Number(data.active_customers) || 0,
          activeTechnicians: Number(data.active_technicians) || 0,
        });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (error) {
    return errorResponse(error);
  }
});
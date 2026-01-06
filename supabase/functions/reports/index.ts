import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

class ApiError extends Error {
  constructor(
    message: string,
    public code: string = "ERROR",
    public status: number = 400
  ) {
    super(message);
  }
}

class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

class ForbiddenError extends ApiError {
  constructor(message: string = "Access denied") {
    super(message, "FORBIDDEN", 403);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("organization_id, full_name, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      throw new UnauthorizedError("User account is inactive");
    }

    const { data: userRoles } = await supabaseAdmin
      .rpc("get_user_roles", { p_user_id: user.id });

    if (!userRoles || userRoles.length === 0) {
      throw new UnauthorizedError("User has no active roles assigned");
    }

    const roles = userRoles.map((r: any) => r.role.key);
    const isAdmin = roles.includes('admin');

    const { data: permissionsList } = await supabaseAdmin
      .rpc("get_user_all_permissions", { p_user_id: user.id });

    const permissions = permissionsList ? permissionsList.map((p: any) => p.permission_key) : [];

    if (!isAdmin && !permissions.includes('reports.view')) {
      throw new ForbiddenError("ليس لديك صلاحية عرض التقارير - You do not have permission to view reports");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    const reportType = lastPart !== 'reports' ? lastPart : undefined;
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (req.method !== "GET") {
      throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }

    let result;

    switch (reportType) {
      case "overview": {
        let workOrdersQuery = supabase
          .from("work_orders")
          .select("id, status, created_at", { count: "exact" })
          .eq("organization_id", profile.organization_id)
          .limit(5000);

        let invoicesQuery = supabase
          .from("invoices")
          .select("id, total, payment_status, created_at", { count: "exact" })
          .eq("organization_id", profile.organization_id)
          .limit(5000);

        if (startDate) {
          workOrdersQuery = workOrdersQuery.gte("created_at", startDate);
          invoicesQuery = invoicesQuery.gte("created_at", startDate);
        }
        if (endDate) {
          workOrdersQuery = workOrdersQuery.lte("created_at", endDate);
          invoicesQuery = invoicesQuery.lte("created_at", endDate);
        }

        const [workOrdersResult, invoicesResult, sparePartsResult, allSpareParts] = await Promise.all([
          workOrdersQuery,
          invoicesQuery,
          supabase.from("work_order_spare_parts").select("quantity, unit_price").limit(5000),
          supabase
            .from("spare_parts")
            .select("quantity, minimum_quantity")
            .eq("organization_id", profile.organization_id)
            .limit(5000),
        ]);

        const workOrders = workOrdersResult.data || [];
        const invoices = invoicesResult.data || [];
        const sparePartsSold = sparePartsResult.data || [];
        const lowStockCount = (allSpareParts.data || []).filter(
          (sp: any) => sp.quantity <= sp.minimum_quantity
        ).length;

        const completedOrders = workOrders.filter((wo: any) => wo.status === "completed").length;
        const pendingOrders = workOrders.filter((wo: any) => wo.status === "pending").length;
        const inProgressOrders = workOrders.filter((wo: any) => wo.status === "in_progress").length;

        const paidInvoices = invoices.filter((inv: any) => inv.payment_status === "paid").length;
        const unpaidInvoices = invoices.filter(
          (inv: any) => inv.payment_status === "unpaid" || inv.payment_status === "partial"
        ).length;

        const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);
        const sparePartsRevenue = sparePartsSold.reduce(
          (sum: number, sp: any) => sum + sp.quantity * sp.unit_price,
          0
        );
        const totalSparePartsSold = sparePartsSold.reduce((sum: number, sp: any) => sum + sp.quantity, 0);

        result = {
          totalRevenue,
          totalWorkOrders: workOrders.length,
          completedOrders,
          pendingOrders,
          inProgressOrders,
          totalInvoices: invoices.length,
          paidInvoices,
          unpaidInvoices,
          totalSparePartsSold,
          sparePartsRevenue,
          lowStockItems: lowStockCount,
        };
        break;
      }

      case "inventory": {
        const [totalCountResult, totalValueResult, allSparePartsResult] = await Promise.all([
          supabase
            .from("spare_parts")
            .select("id", { count: "exact" })
            .eq("organization_id", profile.organization_id),
          supabase
            .from("spare_parts")
            .select("quantity, unit_price")
            .eq("organization_id", profile.organization_id)
            .limit(5000),
          supabase
            .from("spare_parts")
            .select("name, quantity, minimum_quantity")
            .eq("organization_id", profile.organization_id)
            .limit(5000),
        ]);

        if (totalCountResult.error) throw new ApiError(totalCountResult.error.message, "DATABASE_ERROR", 500);
        if (totalValueResult.error) throw new ApiError(totalValueResult.error.message, "DATABASE_ERROR", 500);
        if (allSparePartsResult.error) throw new ApiError(allSparePartsResult.error.message, "DATABASE_ERROR", 500);

        const totalValue = (totalValueResult.data || []).reduce(
          (sum: number, sp: any) => sum + sp.quantity * Number(sp.unit_price),
          0
        );

        const lowStockItems = (allSparePartsResult.data || [])
          .filter((item: any) => item.quantity <= item.minimum_quantity)
          .map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            minimum_quantity: item.minimum_quantity,
          }));

        result = {
          totalItems: totalCountResult.count || 0,
          totalValue,
          lowStockItems,
        };
        break;
      }

      case "technicians": {
        const { data: technicians, error: techError } = await supabase
          .from("technicians")
          .select("id, name, specialization, phone, contract_type, percentage, fixed_salary, base_salary")
          .eq("is_active", true)
          .eq("organization_id", profile.organization_id)
          .limit(100);

        if (techError) throw new ApiError(techError.message, "DATABASE_ERROR", 500);

        let assignmentsQuery = supabase
          .from("technician_assignments")
          .select(`
            technician_id,
            share_amount,
            service:work_order_services!inner(
              service_type,
              description,
              work_order:work_orders!inner(status, created_at)
            )
          `)
          .in("technician_id", (technicians || []).map((t: any) => t.id))
          .eq("service.work_order.status", "completed")
          .limit(5000);

        if (startDate) {
          assignmentsQuery = assignmentsQuery.gte("service.work_order.created_at", startDate);
        }
        if (endDate) {
          assignmentsQuery = assignmentsQuery.lte("service.work_order.created_at", endDate);
        }

        const { data: allAssignments, error: assignmentsError } = await assignmentsQuery;
        if (assignmentsError) throw new ApiError(assignmentsError.message, "DATABASE_ERROR", 500);

        const assignmentsByTech = new Map();
        for (const assignment of allAssignments || []) {
          if (!assignmentsByTech.has(assignment.technician_id)) {
            assignmentsByTech.set(assignment.technician_id, []);
          }
          assignmentsByTech.get(assignment.technician_id).push(assignment);
        }

        const reports = (technicians || []).map((technician: any) => {
          const assignments = assignmentsByTech.get(technician.id) || [];
          const totalRevenue = assignments.reduce((sum: number, a: any) => sum + (a.share_amount || 0), 0);
          const jobsCompleted = assignments.length;
          const averageJobValue = jobsCompleted > 0 ? totalRevenue / jobsCompleted : 0;

          let totalEarnings = 0;
          if (technician.contract_type === "percentage") {
            totalEarnings = (totalRevenue * technician.percentage) / 100;
          } else {
            totalEarnings = technician.fixed_salary || technician.base_salary || 0;
          }

          return {
            technician,
            totalRevenue,
            totalEarnings,
            jobsCompleted,
            averageJobValue,
            jobs: assignments.map((a: any) => ({
              service_type: a.service?.service_type || "",
              description: a.service?.description || "",
              share_amount: a.share_amount,
              created_at: a.service?.work_order?.created_at || "",
            })),
          };
        });

        result = reports.sort((a, b) => b.totalRevenue - a.totalRevenue);
        break;
      }

      default:
        throw new ApiError("Invalid report type. Use: overview, inventory, or technicians", "INVALID_REPORT_TYPE", 400);
    }

    return new Response(
      JSON.stringify({ success: true, data: result, error: null }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    const errorStatus = error.status || 500;
    const errorCode = error.code || "ERROR";
    const errorMessage = error.message || "An unexpected error occurred";

    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: errorCode, message: errorMessage, details: null },
      }),
      {
        status: errorStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
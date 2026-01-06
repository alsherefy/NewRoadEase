import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateWithPermissions } from "../_shared/middleware/authWithPermissions.ts";
import { requirePermission } from "../_shared/middleware/permissionChecker.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const auth = await authenticateWithPermissions(req);
    requirePermission(auth, 'reports.view');

    const supabase = getAuthenticatedClient(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const lastPart = pathParts[pathParts.length - 1];
    const reportType = lastPart !== 'reports' ? lastPart : undefined;
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (req.method !== "GET") {
      throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }

    switch (reportType) {
      case "overview": {
        let workOrdersQuery = supabase
          .from("work_orders")
          .select("id, status, created_at", { count: "exact" })
          .eq("organization_id", auth.organizationId)
          .limit(5000);

        let invoicesQuery = supabase
          .from("invoices")
          .select("id, total, payment_status, created_at", { count: "exact" })
          .eq("organization_id", auth.organizationId)
          .limit(5000);

        if (startDate) {
          workOrdersQuery = workOrdersQuery.gte("created_at", startDate);
          invoicesQuery = invoicesQuery.gte("created_at", startDate);
        }
        if (endDate) {
          workOrdersQuery = workOrdersQuery.lte("created_at", endDate);
          invoicesQuery = invoicesQuery.lte("created_at", endDate);
        }

        const [workOrdersResult, invoicesResult, sparePartsResult, lowStockCount] = await Promise.all([
          workOrdersQuery,
          invoicesQuery,
          supabase
            .from("work_order_spare_parts")
            .select("quantity, unit_price")
            .limit(5000),
          supabase
            .from("spare_parts")
            .select("id", { count: "exact" })
            .eq("organization_id", auth.organizationId)
            .lte("quantity", "minimum_quantity"),
        ]);

        const workOrders = workOrdersResult.data || [];
        const invoices = invoicesResult.data || [];
        const sparePartsSold = sparePartsResult.data || [];

        const completedOrders = workOrders.filter((wo: any) => wo.status === "completed").length;
        const pendingOrders = workOrders.filter((wo: any) => wo.status === "pending").length;
        const inProgressOrders = workOrders.filter((wo: any) => wo.status === "in_progress").length;

        const paidInvoices = invoices.filter((inv: any) => inv.payment_status === "paid").length;
        const unpaidInvoices = invoices.filter((inv: any) => inv.payment_status === "unpaid" || inv.payment_status === "partial").length;

        const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);
        const sparePartsRevenue = sparePartsSold.reduce((sum: number, sp: any) => sum + (sp.quantity * sp.unit_price), 0);
        const totalSparePartsSold = sparePartsSold.reduce((sum: number, sp: any) => sum + sp.quantity, 0);

        return successResponse({
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
          lowStockItems: lowStockCount.count || 0,
        });
      }

      case "inventory": {
        const [totalCountResult, totalValueResult, lowStockResult] = await Promise.all([
          supabase
            .from("spare_parts")
            .select("id", { count: "exact" })
            .eq("organization_id", auth.organizationId),
          supabase
            .from("spare_parts")
            .select("quantity, unit_price")
            .eq("organization_id", auth.organizationId)
            .limit(5000),
          supabase
            .from("spare_parts")
            .select("name, quantity, minimum_quantity")
            .eq("organization_id", auth.organizationId)
            .lte("quantity", "minimum_quantity")
            .limit(100),
        ]);

        if (totalCountResult.error) throw new ApiError(totalCountResult.error.message, "DATABASE_ERROR", 500);
        if (totalValueResult.error) throw new ApiError(totalValueResult.error.message, "DATABASE_ERROR", 500);
        if (lowStockResult.error) throw new ApiError(lowStockResult.error.message, "DATABASE_ERROR", 500);

        const totalValue = (totalValueResult.data || []).reduce(
          (sum: number, sp: any) => sum + (sp.quantity * Number(sp.unit_price)),
          0
        );

        return successResponse({
          totalItems: totalCountResult.count || 0,
          totalValue,
          lowStockItems: (lowStockResult.data || []).map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            minimum_quantity: item.minimum_quantity,
          })),
        });
      }

      case "technicians": {
        const { data: technicians, error: techError } = await supabase
          .from("technicians")
          .select("id, name, specialization, phone, contract_type, percentage, fixed_salary, base_salary")
          .eq("is_active", true)
          .eq("organization_id", auth.organizationId)
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

        return successResponse(reports.sort((a, b) => b.totalRevenue - a.totalRevenue));
      }

      default:
        throw new ApiError("Invalid report type. Use: overview, inventory, or technicians", "INVALID_REPORT_TYPE", 400);
    }
  } catch (error) {
    return errorResponse(error);
  }
});
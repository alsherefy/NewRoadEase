import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabaseClient(authHeader: string | null) {
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    return createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient(req.headers.get("Authorization"));
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const reportType = pathParts[2];
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (req.method !== "GET") {
      return errorResponse("Method not allowed", 405);
    }

    switch (reportType) {
      case "overview": {
        let workOrdersQuery = supabase.from("work_orders").select("*");
        let invoicesQuery = supabase.from("invoices").select("*");

        if (startDate) {
          workOrdersQuery = workOrdersQuery.gte("created_at", startDate);
          invoicesQuery = invoicesQuery.gte("created_at", startDate);
        }
        if (endDate) {
          workOrdersQuery = workOrdersQuery.lte("created_at", endDate);
          invoicesQuery = invoicesQuery.lte("created_at", endDate);
        }

        const [workOrdersResult, invoicesResult, sparePartsResult, allSparePartsResult] = await Promise.all([
          workOrdersQuery,
          invoicesQuery,
          supabase.from("work_order_spare_parts").select("quantity, unit_price"),
          supabase.from("spare_parts").select("*"),
        ]);

        const workOrders = workOrdersResult.data || [];
        const invoices = invoicesResult.data || [];
        const sparePartsSold = sparePartsResult.data || [];
        const allSpareParts = allSparePartsResult.data || [];

        const completedOrders = workOrders.filter((wo: any) => wo.status === "completed").length;
        const pendingOrders = workOrders.filter((wo: any) => wo.status === "pending").length;
        const inProgressOrders = workOrders.filter((wo: any) => wo.status === "in_progress").length;

        const paidInvoices = invoices.filter((inv: any) => inv.payment_status === "paid").length;
        const unpaidInvoices = invoices.filter((inv: any) => inv.payment_status === "unpaid" || inv.payment_status === "partial").length;

        const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);
        const sparePartsRevenue = sparePartsSold.reduce((sum: number, sp: any) => sum + (sp.quantity * sp.unit_price), 0);
        const totalSparePartsSold = sparePartsSold.reduce((sum: number, sp: any) => sum + sp.quantity, 0);
        const lowStockItems = allSpareParts.filter((sp: any) => sp.quantity <= sp.minimum_quantity).length;

        return jsonResponse({
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
          lowStockItems,
        });
      }

      case "inventory": {
        const { data: spareParts, error } = await supabase.from("spare_parts").select("*");
        if (error) return errorResponse(error.message, 500);

        const totalValue = (spareParts || []).reduce((sum: number, sp: any) => sum + (sp.quantity * Number(sp.unit_price)), 0);
        const lowStockItems = (spareParts || []).filter((sp: any) => sp.quantity <= sp.minimum_quantity);

        return jsonResponse({
          totalItems: (spareParts || []).length,
          totalValue,
          lowStockItems: lowStockItems.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            minimum_quantity: item.minimum_quantity,
          })),
        });
      }

      case "technicians": {
        const { data: technicians, error: techError } = await supabase
          .from("technicians")
          .select("*")
          .eq("is_active", true);

        if (techError) return errorResponse(techError.message, 500);

        const reports = [];

        for (const technician of technicians || []) {
          let query = supabase
            .from("technician_assignments")
            .select(`
              *,
              service:work_order_services!inner(
                *,
                work_order:work_orders!inner(status, created_at)
              )
            `)
            .eq("technician_id", technician.id)
            .eq("service.work_order.status", "completed");

          if (startDate) {
            query = query.gte("service.work_order.created_at", startDate);
          }
          if (endDate) {
            query = query.lte("service.work_order.created_at", endDate);
          }

          const { data: assignments } = await query;

          const totalRevenue = (assignments || []).reduce((sum: number, a: any) => sum + (a.share_amount || 0), 0);
          const jobsCompleted = (assignments || []).length;
          const averageJobValue = jobsCompleted > 0 ? totalRevenue / jobsCompleted : 0;

          let totalEarnings = 0;
          if (technician.contract_type === "percentage") {
            totalEarnings = (totalRevenue * technician.percentage) / 100;
          } else {
            totalEarnings = technician.fixed_salary;
          }

          reports.push({
            technician,
            totalRevenue,
            totalEarnings,
            jobsCompleted,
            averageJobValue,
            jobs: (assignments || []).map((a: any) => ({
              service_type: a.service?.service_type || "",
              description: a.service?.description || "",
              share_amount: a.share_amount,
              created_at: a.service?.work_order?.created_at || "",
            })),
          });
        }

        return jsonResponse(reports.sort((a, b) => b.totalRevenue - a.totalRevenue));
      }

      default:
        return errorResponse("Invalid report type. Use: overview, inventory, or technicians", 400);
    }
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500);
  }
});
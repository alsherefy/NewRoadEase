import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authenticateWithPermissions } from "../_shared/middleware/authWithPermissions.ts";
import { requirePermission, hasPermission } from "../_shared/middleware/permissionChecker.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { getSupabaseClient } from "../_shared/utils/supabase.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const auth = await authenticateWithPermissions(req);
    requirePermission(auth, 'dashboard.view');

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const supabase = getSupabaseClient();

    console.log('🎯 Dashboard request:', { path, orgId: auth.organizationId });

    switch (req.method) {
      case "GET": {
        const endpoint = path[path.length - 1];

        switch (endpoint) {
          case "dashboard":
          case "stats": {
            return await getBasicStats(supabase, auth);
          }

          case "enhanced": {
            return await getEnhancedDashboard(supabase, auth);
          }

          default: {
            return await getBasicStats(supabase, auth);
          }
        }
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    return errorResponse(error);
  }
});

async function getBasicStats(supabase: any, auth: any) {
  const { data, error } = await supabase
    .rpc("get_dashboard_stats", { p_organization_id: auth.organizationId })
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

async function getEnhancedDashboard(supabase: any, auth: any) {
  console.log('📊 Starting enhanced dashboard fetch');
  
  const result: any = {
    sections: {},
    permissions: {},
  };

  result.permissions = {
    financialStats: hasPermission(auth, 'dashboard.view_financial_stats'),
    openOrders: hasPermission(auth, 'dashboard.view_open_orders'),
    openInvoices: hasPermission(auth, 'dashboard.view_open_invoices'),
    inventoryAlerts: hasPermission(auth, 'dashboard.view_inventory_alerts'),
    expenses: hasPermission(auth, 'dashboard.view_expenses'),
    techniciansPerformance: hasPermission(auth, 'dashboard.view_technicians_performance'),
    activities: hasPermission(auth, 'dashboard.view_activities'),
  };

  console.log('✅ User permissions:', result.permissions);

  const promises: Promise<void>[] = [];

  if (result.permissions.financialStats) {
    promises.push(
      getFinancialSummary(supabase, auth).then(res => {
        result.sections.financialStats = res;
      }).catch(err => {
        console.error('❌ Financial stats error:', err);
        result.sections.financialStats = null;
      })
    );
  }

  if (result.permissions.openOrders) {
    promises.push(
      getOpenOrders(supabase, auth).then(res => {
        result.sections.openOrders = res;
      }).catch(err => {
        console.error('❌ Open orders error:', err);
        result.sections.openOrders = null;
      })
    );
  }

  if (result.permissions.openInvoices) {
    promises.push(
      getOpenInvoices(supabase, auth).then(res => {
        result.sections.openInvoices = res;
      }).catch(err => {
        console.error('❌ Open invoices error:', err);
        result.sections.openInvoices = null;
      })
    );
  }

  if (result.permissions.inventoryAlerts) {
    promises.push(
      getInventoryAlerts(supabase, auth).then(res => {
        result.sections.inventoryAlerts = res;
      }).catch(err => {
        console.error('❌ Inventory alerts error:', err);
        result.sections.inventoryAlerts = null;
      })
    );
  }

  if (result.permissions.expenses) {
    promises.push(
      getExpensesSummary(supabase, auth).then(res => {
        result.sections.expenses = res;
      }).catch(err => {
        console.error('❌ Expenses error:', err);
        result.sections.expenses = null;
      })
    );
  }

  if (result.permissions.techniciansPerformance) {
    promises.push(
      getTechniciansPerformance(supabase, auth).then(res => {
        result.sections.techniciansPerformance = res;
      }).catch(err => {
        console.error('❌ Technicians error:', err);
        result.sections.techniciansPerformance = null;
      })
    );
  }

  await Promise.all(promises);

  console.log('✅ Enhanced dashboard complete:', Object.keys(result.sections));

  return successResponse(result);
}

async function getOpenOrders(supabase: any, auth: any) {
  console.log('🔧 Fetching open orders for org:', auth.organizationId);

  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      id,
      order_number,
      status,
      description,
      total_labor_cost,
      created_at,
      customers:customer_id (
        id,
        name,
        phone
      ),
      vehicles:vehicle_id (
        id,
        car_make,
        car_model,
        plate_number
      )
    `)
    .eq('organization_id', auth.organizationId)
    .in('status', ['in_progress', 'pending'])
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('📦 Work orders result:', { count: data?.length, error: error?.message });

  if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);

  const inProgress = data?.filter((wo: any) => wo.status === 'in_progress') || [];
  const pending = data?.filter((wo: any) => wo.status === 'pending') || [];

  return {
    inProgress: inProgress.slice(0, 5),
    pending: pending.slice(0, 5),
    totalCount: data?.length || 0,
  };
}

async function getOpenInvoices(supabase: any, auth: any) {
  console.log('🔍 Fetching open invoices for org:', auth.organizationId);

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      payment_status,
      total,
      paid_amount,
      created_at,
      customers:customer_id (
        id,
        name,
        phone
      ),
      vehicles:vehicle_id (
        id,
        car_make,
        car_model,
        plate_number
      )
    `)
    .eq('organization_id', auth.organizationId)
    .in('payment_status', ['unpaid', 'partial'])
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('📋 Invoices result:', { count: data?.length, error: error?.message });

  if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);

  const unpaid = data?.filter((inv: any) => inv.payment_status === 'unpaid') || [];
  const overdue = unpaid.filter((inv: any) => {
    const daysOld = Math.floor((Date.now() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return daysOld > 7;
  });

  const totalAmount = data?.reduce((sum: number, inv: any) => {
    return sum + (Number(inv.total) - Number(inv.paid_amount));
  }, 0) || 0;

  console.log('✅ Open invoices:', { unpaidCount: unpaid.length, totalAmount });

  return {
    unpaid: unpaid.slice(0, 5),
    overdue: overdue.slice(0, 5),
    totalAmount: Number(totalAmount.toFixed(2)),
    totalCount: data?.length || 0,
  };
}

async function getFinancialSummary(supabase: any, auth: any) {
  console.log('💰 Fetching financial summary for org:', auth.organizationId);

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('paid_amount, created_at')
    .eq('organization_id', auth.organizationId)
    .gte('created_at', startOfMonth);

  console.log('📋 Invoices for financial:', { count: invoices?.length, error: invError?.message });

  if (invError) throw new ApiError(invError.message, "DATABASE_ERROR", 500);

  const todayRevenue = invoices?.filter((inv: any) => inv.created_at >= startOfDay)
    .reduce((sum: number, inv: any) => sum + Number(inv.paid_amount), 0) || 0;

  const weekRevenue = invoices?.filter((inv: any) => inv.created_at >= startOfWeek)
    .reduce((sum: number, inv: any) => sum + Number(inv.paid_amount), 0) || 0;

  const monthRevenue = invoices?.reduce((sum: number, inv: any) => sum + Number(inv.paid_amount), 0) || 0;

  const { data: expenses, error: expError } = await supabase
    .from('expenses')
    .select('amount, expense_date')
    .eq('organization_id', auth.organizationId)
    .gte('expense_date', startOfDay);

  console.log('💸 Expenses for today:', { count: expenses?.length, error: expError?.message });

  if (expError) throw new ApiError(expError.message, "DATABASE_ERROR", 500);

  const todayExpenses = expenses?.reduce((sum: number, exp: any) => sum + Number(exp.amount), 0) || 0;

  const result = {
    todayRevenue: Number(todayRevenue.toFixed(2)),
    weekRevenue: Number(weekRevenue.toFixed(2)),
    monthRevenue: Number(monthRevenue.toFixed(2)),
    todayExpenses: Number(todayExpenses.toFixed(2)),
    netProfit: Number((todayRevenue - todayExpenses).toFixed(2)),
  };

  console.log('✅ Financial summary:', result);

  return result;
}

async function getInventoryAlerts(supabase: any, auth: any) {
  console.log('📦 Fetching inventory alerts for org:', auth.organizationId);

  const { data, error } = await supabase
    .from('spare_parts')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .or('quantity.eq.0,quantity.lte.minimum_quantity')
    .order('quantity', { ascending: true })
    .limit(10);

  console.log('📦 Inventory result:', { count: data?.length, error: error?.message });

  if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);

  const outOfStock = data?.filter((part: any) => part.quantity === 0) || [];
  const lowStock = data?.filter((part: any) => part.quantity > 0 && part.quantity <= part.minimum_quantity) || [];

  return {
    outOfStock: outOfStock.slice(0, 5),
    lowStock: lowStock.slice(0, 5),
    totalLowStockItems: data?.length || 0,
  };
}

async function getExpensesSummary(supabase: any, auth: any) {
  console.log('💸 Fetching expenses summary for org:', auth.organizationId);

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const { data: installments, error: instError } = await supabase
    .from('expense_installments')
    .select(`
      *,
      expenses:expense_id (
        expense_number,
        description,
        category
      )
    `)
    .eq('organization_id', auth.organizationId)
    .gte('due_date', startOfDay)
    .lt('due_date', endOfDay)
    .eq('payment_status', 'pending')
    .order('due_date', { ascending: true })
    .limit(5);

  console.log('💳 Installments result:', { count: installments?.length, error: instError?.message });

  if (instError) throw new ApiError(instError.message, "DATABASE_ERROR", 500);

  const { data: monthlyExpenses, error: monthError } = await supabase
    .from('expenses')
    .select('category, amount')
    .eq('organization_id', auth.organizationId)
    .gte('expense_date', startOfMonth);

  console.log('💰 Monthly expenses result:', { count: monthlyExpenses?.length, error: monthError?.message });

  if (monthError) throw new ApiError(monthError.message, "DATABASE_ERROR", 500);

  const byCategory: Record<string, number> = {};
  let monthlyTotal = 0;

  monthlyExpenses?.forEach((exp: any) => {
    const category = exp.category || 'other';
    byCategory[category] = (byCategory[category] || 0) + Number(exp.amount);
    monthlyTotal += Number(exp.amount);
  });

  return {
    dueToday: installments || [],
    monthlyTotal: Number(monthlyTotal.toFixed(2)),
    byCategory,
  };
}

async function getTechniciansPerformance(supabase: any, auth: any) {
  console.log('👷 Fetching technicians for org:', auth.organizationId);

  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('👷 Technicians result:', { count: data?.length, error: error?.message });

  if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);

  return {
    activeTechnicians: data?.length || 0,
    technicians: data || [],
  };
}
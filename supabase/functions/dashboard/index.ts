import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AuthContext {
  userId: string;
  organizationId: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  isAdmin: boolean;
  permissions: string[];
}

class ApiError extends Error {
  constructor(
    message: string,
    public code: string = "ERROR",
    public status: number = 400
  ) {
    super(message);
    this.name = "ApiError";
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

function getServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

function corsResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

function successResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify({
    success: true,
    data,
    error: null,
  }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(error: any, status?: number): Response {
  const errorStatus = status || error.status || 500;
  const errorCode = error.code || "ERROR";
  const errorMessage = error.message || "An unexpected error occurred";

  return new Response(JSON.stringify({
    success: false,
    data: null,
    error: {
      code: errorCode,
      message: errorMessage,
    },
  }), {
    status: errorStatus,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function authenticateWithPermissions(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = getServiceRoleClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("organization_id, full_name, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new UnauthorizedError("User profile not found");
  }

  if (!profile.is_active) {
    throw new UnauthorizedError("User account is inactive");
  }

  if (!profile.organization_id) {
    throw new UnauthorizedError("User is not assigned to an organization");
  }

  const { data: userRoles, error: rolesError } = await supabase
    .rpc("get_user_roles", { p_user_id: user.id });

  if (rolesError || !userRoles || userRoles.length === 0) {
    throw new UnauthorizedError("User has no active roles assigned");
  }

  const roles: string[] = userRoles.map((r: any) => r.role.key);
  const isAdmin = roles.includes('admin');

  let permissions: string[] = [];
  const { data: permissionsList, error: permissionsError } = await supabase
    .rpc("get_user_all_permissions", { p_user_id: user.id });

  if (!permissionsError && permissionsList) {
    permissions = permissionsList.map((p: any) => p.permission_key);
  }

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    email: user.email || '',
    fullName: profile.full_name,
    isActive: profile.is_active,
    roles,
    isAdmin,
    permissions,
  };
}

function hasPermission(auth: AuthContext, permissionKey: string): boolean {
  if (auth.isAdmin) return true;
  return auth.permissions.includes(permissionKey);
}

function requirePermission(auth: AuthContext, permissionKey: string): void {
  if (!hasPermission(auth, permissionKey)) {
    throw new ForbiddenError(
      `ليس لديك صلاحية ${permissionKey} - You do not have permission to ${permissionKey}`
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const auth = await authenticateWithPermissions(req);
    requirePermission(auth, 'dashboard.view');

    const url = new URL(req.url);
    const pathname = url.pathname;
    
    console.log('🎯 Dashboard request:', { pathname, orgId: auth.organizationId });

    const supabase = getServiceRoleClient();

    if (pathname.endsWith('/enhanced') || pathname.includes('/dashboard/enhanced')) {
      return await getEnhancedDashboard(supabase, auth);
    } else {
      return await getBasicStats(supabase, auth);
    }
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    return errorResponse(error);
  }
});

async function getBasicStats(supabase: any, auth: AuthContext) {
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

async function getEnhancedDashboard(supabase: any, auth: AuthContext) {
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
        result.sections.financialStats = {
          todayRevenue: 0,
          weekRevenue: 0,
          monthRevenue: 0,
          todayExpenses: 0,
          netProfit: 0,
        };
      })
    );
  }

  if (result.permissions.openOrders) {
    promises.push(
      getOpenOrders(supabase, auth).then(res => {
        result.sections.openOrders = res;
      }).catch(err => {
        console.error('❌ Open orders error:', err);
        result.sections.openOrders = {
          inProgress: [],
          pending: [],
          totalCount: 0,
        };
      })
    );
  }

  if (result.permissions.openInvoices) {
    promises.push(
      getOpenInvoices(supabase, auth).then(res => {
        result.sections.openInvoices = res;
      }).catch(err => {
        console.error('❌ Open invoices error:', err);
        result.sections.openInvoices = {
          unpaidInvoices: [],
          overdueInvoices: [],
          totalAmount: 0,
          totalCount: 0,
        };
      })
    );
  }

  if (result.permissions.inventoryAlerts) {
    promises.push(
      getInventoryAlerts(supabase, auth).then(res => {
        result.sections.inventoryAlerts = res;
      }).catch(err => {
        console.error('❌ Inventory alerts error:', err);
        result.sections.inventoryAlerts = {
          outOfStock: [],
          lowStock: [],
          totalLowStockItems: 0,
        };
      })
    );
  }

  if (result.permissions.expenses) {
    promises.push(
      getExpensesSummary(supabase, auth).then(res => {
        result.sections.expenses = res;
      }).catch(err => {
        console.error('❌ Expenses error:', err);
        result.sections.expenses = {
          dueToday: [],
          monthlyTotal: 0,
          byCategory: {},
        };
      })
    );
  }

  if (result.permissions.techniciansPerformance) {
    promises.push(
      getTechniciansPerformance(supabase, auth).then(res => {
        result.sections.techniciansPerformance = res;
      }).catch(err => {
        console.error('❌ Technicians error:', err);
        result.sections.techniciansPerformance = {
          activeTechnicians: 0,
          technicians: [],
        };
      })
    );
  }

  await Promise.all(promises);

  console.log('✅ Enhanced dashboard complete:', Object.keys(result.sections));

  return successResponse(result);
}

async function getOpenOrders(supabase: any, auth: AuthContext) {
  console.log('🔧 Fetching open orders for org:', auth.organizationId);

  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      id,
      order_number,
      status,
      created_at,
      total_labor_cost,
      customers!customer_id (
        id,
        name,
        phone
      ),
      vehicles!vehicle_id (
        id,
        car_make,
        car_model,
        plate_number
      )
    `)
    .eq('organization_id', auth.organizationId)
    .in('status', ['in_progress', 'pending'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('📦 Work orders result:', { count: data?.length, error: error?.message });

  if (error) {
    console.error('Full error:', JSON.stringify(error, null, 2));
    return {
      inProgress: [],
      pending: [],
      totalCount: 0,
    };
  }

  const inProgress = data?.filter((wo: any) => wo.status === 'in_progress') || [];
  const pending = data?.filter((wo: any) => wo.status === 'pending') || [];

  return {
    inProgress: inProgress.slice(0, 5),
    pending: pending.slice(0, 5),
    totalCount: data?.length || 0,
  };
}

async function getOpenInvoices(supabase: any, auth: AuthContext) {
  console.log('🔍 [OPEN INVOICES] Starting query');
  console.log('🔍 [OPEN INVOICES] User org:', auth.organizationId);

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      payment_status,
      total,
      paid_amount,
      due_date,
      created_at,
      customers!customer_id (
        id,
        name,
        phone
      ),
      vehicles!vehicle_id (
        id,
        car_make,
        car_model,
        plate_number
      )
    `)
    .eq('organization_id', auth.organizationId)
    .neq('payment_status', 'paid')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  console.log('📋 [OPEN INVOICES] Query result:', {
    count: data?.length,
    error: error?.message,
    invoices: data?.map((i: any) => ({
      number: i.invoice_number,
      status: i.payment_status,
      total: i.total,
      paid: i.paid_amount,
      dueDate: i.due_date,
      customer: i.customers?.name
    }))
  });

  if (error) {
    console.error('❌ [OPEN INVOICES] Error:', JSON.stringify(error, null, 2));
    return {
      unpaidInvoices: [],
      overdueInvoices: [],
      totalAmount: 0,
      totalCount: 0,
    };
  }

  if (!data || data.length === 0) {
    console.log('⚠️ [OPEN INVOICES] No unpaid invoices found');
    return {
      unpaidInvoices: [],
      overdueInvoices: [],
      totalAmount: 0,
      totalCount: 0,
    };
  }

  const now = new Date();
  const unpaid = data || [];
  const overdue = unpaid.filter((inv: any) => {
    if (inv.due_date) {
      return new Date(inv.due_date) < now;
    }
    const daysOld = Math.floor((now.getTime() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return daysOld > 30;
  });

  const totalAmount = unpaid.reduce((sum: number, inv: any) => {
    return sum + (Number(inv.total) - Number(inv.paid_amount || 0));
  }, 0) || 0;

  console.log('✅ [OPEN INVOICES] Success:', {
    unpaidCount: unpaid.length,
    overdueCount: overdue.length,
    totalAmount,
    overdueInvoices: overdue.map((i: any) => ({
      number: i.invoice_number,
      dueDate: i.due_date,
      amount: i.total
    }))
  });

  return {
    unpaidInvoices: unpaid.slice(0, 5),
    overdueInvoices: overdue.slice(0, 5),
    totalAmount: Number(totalAmount.toFixed(2)),
    totalCount: unpaid.length,
  };
}

async function getFinancialSummary(supabase: any, auth: AuthContext) {
  console.log('💰 [FINANCIAL] Starting financial summary');

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfDay = today.toISOString();
  const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('paid_amount, paid_at, payment_status, invoice_number')
    .eq('organization_id', auth.organizationId)
    .eq('payment_status', 'paid')
    .gte('paid_at', startOfMonth)
    .is('deleted_at', null)
    .limit(1000);

  console.log('📋 [FINANCIAL] Paid invoices since start of month:', {
    count: invoices?.length,
    error: invError?.message,
    invoices: invoices?.map((i: any) => ({
      number: i.invoice_number,
      paidAt: i.paid_at,
      amount: i.paid_amount
    }))
  });

  if (invError) {
    console.error('❌ [FINANCIAL] Error:', JSON.stringify(invError, null, 2));
    return {
      todayRevenue: 0,
      weekRevenue: 0,
      monthRevenue: 0,
      todayExpenses: 0,
      netProfit: 0,
    };
  }

  const paidInvoices = invoices || [];

  const todayRevenue = paidInvoices
    .filter((inv: any) => inv.paid_at && inv.paid_at >= startOfDay)
    .reduce((sum: number, inv: any) => sum + Number(inv.paid_amount || 0), 0) || 0;

  const weekRevenue = paidInvoices
    .filter((inv: any) => inv.paid_at && inv.paid_at >= startOfWeek)
    .reduce((sum: number, inv: any) => sum + Number(inv.paid_amount || 0), 0) || 0;

  const monthRevenue = paidInvoices
    .reduce((sum: number, inv: any) => sum + Number(inv.paid_amount || 0), 0) || 0;

  const { data: expenses, error: expError } = await supabase
    .from('expenses')
    .select('amount, expense_date')
    .eq('organization_id', auth.organizationId)
    .gte('expense_date', startOfDay)
    .is('deleted_at', null)
    .limit(500);

  if (expError) {
    console.error('❌ [FINANCIAL] Expense error:', JSON.stringify(expError, null, 2));
  }

  const todayExpenses = expenses?.reduce((sum: number, exp: any) => sum + Number(exp.amount), 0) || 0;

  const result = {
    todayRevenue: Number(todayRevenue.toFixed(2)),
    weekRevenue: Number(weekRevenue.toFixed(2)),
    monthRevenue: Number(monthRevenue.toFixed(2)),
    todayExpenses: Number(todayExpenses.toFixed(2)),
    netProfit: Number((todayRevenue - todayExpenses).toFixed(2)),
  };

  console.log('✅ [FINANCIAL] Final result:', result);

  return result;
}

async function getInventoryAlerts(supabase: any, auth: AuthContext) {
  const { data, error } = await supabase
    .from('spare_parts')
    .select('id, part_number, name, quantity, minimum_quantity, unit_price')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .order('quantity', { ascending: true })
    .limit(20);

  if (error) {
    console.error('Inventory error:', error);
    return {
      outOfStock: [],
      lowStock: [],
      totalLowStockItems: 0,
    };
  }

  const outOfStock = data?.filter((part: any) => Number(part.quantity) === 0) || [];
  const lowStock = data?.filter((part: any) => {
    const qty = Number(part.quantity);
    const minQty = Number(part.minimum_quantity || 0);
    return qty > 0 && qty <= minQty;
  }) || [];

  return {
    outOfStock: outOfStock.slice(0, 5),
    lowStock: lowStock.slice(0, 5),
    totalLowStockItems: outOfStock.length + lowStock.length,
  };
}

async function getExpensesSummary(supabase: any, auth: AuthContext) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const { data: installments, error: instError } = await supabase
    .from('expense_installments')
    .select(`
      id,
      installment_number,
      amount,
      due_date,
      payment_status,
      expenses!expense_id (
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

  if (instError) {
    console.error('Installments error:', instError);
  }

  const { data: monthlyExpenses, error: monthError } = await supabase
    .from('expenses')
    .select('category, amount')
    .eq('organization_id', auth.organizationId)
    .gte('expense_date', startOfMonth)
    .is('deleted_at', null)
    .limit(500);

  if (monthError) {
    console.error('Monthly expenses error:', monthError);
  }

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

async function getTechniciansPerformance(supabase: any, auth: AuthContext) {
  const { data, error } = await supabase
    .from('technicians')
    .select('id, name, specialization, phone, is_active, base_salary')
    .eq('organization_id', auth.organizationId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Technicians error:', error);
    return {
      activeTechnicians: 0,
      technicians: [],
    };
  }

  return {
    activeTechnicians: data?.length || 0,
    technicians: data || [],
  };
}
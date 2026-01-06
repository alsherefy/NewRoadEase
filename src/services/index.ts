import { supabase } from '../lib/supabase';
import { apiClient, ApiError } from './apiClient';
import { User, UserPermission, Customer, Vehicle, WorkOrder, Invoice, Technician, Salary, SparePart, Expense } from '../types';
import type { User as SupabaseUser, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { cache, CacheKeys, CacheTTL } from '../utils/cacheUtils';

export { ApiError as ServiceError } from './apiClient';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  count?: number;
  hasMore: boolean;
}

class WorkOrdersService {
  async getAllWorkOrders(options?: QueryOptions): Promise<WorkOrder[]> {
    const params: Record<string, string> = {};
    if (options?.orderBy) params.orderBy = options.orderBy;
    if (options?.orderDirection) params.orderDir = options.orderDirection;

    const result = await apiClient.get<PaginatedResponse<WorkOrder>>('work-orders', { ...params, limit: '1000' });
    return result.data;
  }

  async getPaginatedWorkOrders(options: QueryOptions & { status?: string }): Promise<PaginatedResponse<WorkOrder>> {
    const params: Record<string, string> = {};
    if (options.limit) params.limit = String(options.limit);
    if (options.offset) params.offset = String(options.offset);
    if (options.orderBy) params.orderBy = options.orderBy;
    if (options.orderDirection) params.orderDir = options.orderDirection;
    if (options.status) params.status = options.status;

    return apiClient.get<PaginatedResponse<WorkOrder>>('work-orders', params);
  }

  async getWorkOrderById(id: string): Promise<WorkOrder> {
    return apiClient.get<WorkOrder>(`work-orders/${id}`);
  }

  async createWorkOrder(data: Partial<WorkOrder> & { services?: unknown[]; spare_parts?: unknown[] }): Promise<WorkOrder> {
    return apiClient.post<WorkOrder>('work-orders', data);
  }

  async updateWorkOrder(id: string, data: Partial<WorkOrder>): Promise<WorkOrder> {
    return apiClient.put<WorkOrder>(`work-orders/${id}`, data);
  }

  async deleteWorkOrder(id: string): Promise<void> {
    await apiClient.delete(`work-orders/${id}`);
  }
}

class InvoicesService {
  async getPaginatedInvoices(options: QueryOptions): Promise<PaginatedResponse<Invoice>> {
    const params: Record<string, string> = {};
    if (options.limit) params.limit = String(options.limit);
    if (options.offset) params.offset = String(options.offset);
    if (options.orderBy) params.orderBy = options.orderBy;
    if (options.orderDirection) params.orderDir = options.orderDirection;

    return apiClient.get<PaginatedResponse<Invoice>>('invoices', params);
  }

  async getInvoiceById(id: string): Promise<Invoice> {
    return apiClient.get<Invoice>(`invoices/${id}`);
  }

  async createInvoice(data: Partial<Invoice> & { items?: unknown[] }): Promise<Invoice> {
    return apiClient.post<Invoice>('invoices', data);
  }

  async updateInvoice(id: string, data: Partial<Invoice> & { items?: unknown[] }): Promise<Invoice> {
    return apiClient.put<Invoice>(`invoices/${id}`, data);
  }

  async deleteInvoice(id: string): Promise<void> {
    await apiClient.delete(`invoices/${id}`);
  }
}

class CustomersService {
  async getAllCustomers(options?: QueryOptions): Promise<Customer[]> {
    const params: Record<string, string> = {};
    if (options?.orderBy) params.orderBy = options.orderBy;
    if (options?.orderDirection) params.orderDir = options.orderDirection;

    const result = await apiClient.get<PaginatedResponse<Customer>>('customers', { ...params, limit: '1000' });
    return result.data;
  }

  async getPaginatedCustomers(options: QueryOptions): Promise<PaginatedResponse<Customer>> {
    const params: Record<string, string> = {};
    if (options.limit) params.limit = String(options.limit);
    if (options.offset) params.offset = String(options.offset);
    if (options.orderBy) params.orderBy = options.orderBy;
    if (options.orderDirection) params.orderDir = options.orderDirection;

    return apiClient.get<PaginatedResponse<Customer>>('customers', params);
  }

  async getCustomerById(id: string): Promise<Customer> {
    return apiClient.get<Customer>(`customers/${id}`);
  }

  async createCustomer(data: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
    return apiClient.post<Customer>('customers', data);
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    return apiClient.put<Customer>(`customers/${id}`, data);
  }

  async deleteCustomer(id: string): Promise<void> {
    await apiClient.delete(`customers/${id}`);
  }
}

class VehiclesService {
  async getVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
    return apiClient.get<Vehicle[]>('vehicles', { customerId });
  }

  async getVehicleById(id: string): Promise<Vehicle> {
    return apiClient.get<Vehicle>(`vehicles/${id}`);
  }

  async createVehicle(data: Omit<Vehicle, 'id' | 'created_at'>): Promise<Vehicle> {
    return apiClient.post<Vehicle>('vehicles', data);
  }

  async updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    return apiClient.put<Vehicle>(`vehicles/${id}`, data);
  }

  async deleteVehicle(id: string): Promise<void> {
    await apiClient.delete(`vehicles/${id}`);
  }
}

class TechniciansService {
  async getAllTechnicians(options?: QueryOptions): Promise<Technician[]> {
    const params: Record<string, string> = {};
    if (options?.orderBy) params.orderBy = options.orderBy;
    if (options?.orderDirection) params.orderDir = options.orderDirection;

    return apiClient.get<Technician[]>('technicians', params);
  }

  async getActiveTechnicians(): Promise<Technician[]> {
    return cache.fetchWithCache(
      CacheKeys.TECHNICIANS_LIST,
      () => apiClient.get<Technician[]>('technicians', { activeOnly: 'true' }),
      CacheTTL.MEDIUM
    );
  }

  invalidateCache(): void {
    cache.remove(CacheKeys.TECHNICIANS_LIST);
  }

  async getTechnicianById(id: string): Promise<Technician> {
    return apiClient.get<Technician>(`technicians/${id}`);
  }

  async createTechnician(data: Omit<Technician, 'id' | 'created_at' | 'updated_at'>): Promise<Technician> {
    const result = await apiClient.post<Technician>('technicians', data);
    this.invalidateCache();
    return result;
  }

  async updateTechnician(id: string, data: Partial<Technician>): Promise<Technician> {
    const result = await apiClient.put<Technician>(`technicians/${id}`, data);
    this.invalidateCache();
    return result;
  }

  async deleteTechnician(id: string): Promise<void> {
    await apiClient.delete(`technicians/${id}`);
    this.invalidateCache();
  }
}

class InventoryService {
  async getAllSpareParts(options?: QueryOptions): Promise<SparePart[]> {
    const params: Record<string, string> = {};
    if (options?.orderBy) params.orderBy = options.orderBy;
    if (options?.orderDirection) params.orderDir = options.orderDirection;

    return apiClient.get<SparePart[]>('inventory', params);
  }

  async getLowStockSpareParts(): Promise<SparePart[]> {
    return apiClient.get<SparePart[]>('inventory', { lowStockOnly: 'true' });
  }

  async getSparePartById(id: string): Promise<SparePart> {
    return apiClient.get<SparePart>(`inventory/${id}`);
  }

  async createSparePart(data: Omit<SparePart, 'id' | 'created_at' | 'updated_at'>): Promise<SparePart> {
    return apiClient.post<SparePart>('inventory', data);
  }

  async updateSparePart(id: string, data: Partial<SparePart>): Promise<SparePart> {
    return apiClient.put<SparePart>(`inventory/${id}`, data);
  }

  async deleteSparePart(id: string): Promise<void> {
    await apiClient.delete(`inventory/${id}`);
  }
}

class AuthService {
  async signIn(email: string, password: string): Promise<{ user: SupabaseUser; session: Session }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new ApiError(error.message, 401);
    if (!data.user || !data.session) throw new ApiError('No user or session returned', 401);
    return { user: data.user, session: data.session };
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new ApiError(error.message, 500);
  }

  async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  async getUserProfile(userId: string): Promise<User | null> {
    try {
      return await apiClient.get<User>(`users/${userId}/profile`);
    } catch {
      return null;
    }
  }
}

class UsersService {
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return cache.fetchWithCache(
      CacheKeys.USER_PERMISSIONS(userId),
      () => apiClient.get<UserPermission[]>(`users/${userId}/permissions`),
      CacheTTL.MEDIUM
    );
  }

  invalidateUserPermissionsCache(userId: string): void {
    cache.remove(CacheKeys.USER_PERMISSIONS(userId));
  }

  async getAllUsers(): Promise<User[]> {
    return apiClient.get<User[]>('users');
  }

  async getUserById(id: string): Promise<User> {
    return apiClient.get<User>(`users/${id}`);
  }

  async createUser(data: { email: string; password: string; name: string; role?: string; permission_ids?: string[] }): Promise<User> {
    return apiClient.post<User>('users/create', {
      email: data.email,
      password: data.password,
      name: data.name,
      role_key: data.role || 'receptionist',
      permission_ids: data.permission_ids || []
    });
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return apiClient.put<User>(`users/${id}`, data);
  }

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`users/${id}`);
  }

  async updatePermissions(userId: string, permissions: Array<{ permission_key: string; can_view: boolean; can_edit: boolean }>): Promise<void> {
    await apiClient.put(`users/${userId}/permissions`, { permissions });
    this.invalidateUserPermissionsCache(userId);
  }
}

class SalariesService {
  async getAllSalaries(options?: QueryOptions): Promise<Salary[]> {
    const params: Record<string, string> = {};
    if (options?.orderBy) params.orderBy = options.orderBy;
    if (options?.orderDirection) params.orderDir = options.orderDirection;

    return apiClient.get<Salary[]>('salaries', params);
  }

  async getSalariesByTechnician(technicianId: string): Promise<Salary[]> {
    return apiClient.get<Salary[]>('salaries', { technicianId });
  }

  async getSalaryById(id: string): Promise<Salary> {
    return apiClient.get<Salary>(`salaries/${id}`);
  }

  async createSalary(data: Omit<Salary, 'id' | 'created_at' | 'updated_at' | 'salary_number'>): Promise<Salary> {
    return apiClient.post<Salary>('salaries', data);
  }

  async updateSalary(id: string, data: Partial<Salary>): Promise<Salary> {
    return apiClient.put<Salary>(`salaries/${id}`, data);
  }

  async deleteSalary(id: string): Promise<void> {
    await apiClient.delete(`salaries/${id}`);
  }
}

class ExpensesService {
  async getAllExpenses(options?: QueryOptions): Promise<Expense[]> {
    const params: Record<string, string> = {};
    if (options?.orderBy) params.orderBy = options.orderBy;
    if (options?.orderDirection) params.orderDir = options.orderDirection;

    return apiClient.get<Expense[]>('expenses', params);
  }

  async getExpenseById(id: string): Promise<Expense> {
    return apiClient.get<Expense>(`expenses/${id}`);
  }

  async createExpense(data: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'expense_number'>): Promise<Expense> {
    return apiClient.post<Expense>('expenses', data);
  }

  async updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
    return apiClient.put<Expense>(`expenses/${id}`, data);
  }

  async deleteExpense(id: string): Promise<void> {
    await apiClient.delete(`expenses/${id}`);
  }

  async getExpenseInstallments(expenseId: string): Promise<unknown[]> {
    return apiClient.get<unknown[]>(`expenses/${expenseId}/installments`);
  }

  async updateInstallment(expenseId: string, installmentId: string, data: { is_paid: boolean; paid_date?: string }): Promise<void> {
    await apiClient.put(`expenses/${expenseId}/installments/${installmentId}`, data);
  }
}

interface OverviewStats {
  totalRevenue: number;
  totalWorkOrders: number;
  completedOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  totalSparePartsSold: number;
  sparePartsRevenue: number;
  lowStockItems: number;
}

interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockItems: Array<{ name: string; quantity: number; minimum_quantity: number }>;
}

interface TechnicianReport {
  technician: Technician;
  totalRevenue: number;
  totalEarnings: number;
  jobsCompleted: number;
  averageJobValue: number;
  jobs: Array<{
    service_type: string;
    description: string;
    share_amount: number;
    created_at: string;
  }>;
}

class ReportsService {
  async getOverviewStats(startDate?: string, endDate?: string): Promise<OverviewStats> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    return apiClient.get<OverviewStats>('reports/overview', params);
  }

  async getInventoryStats(): Promise<InventoryStats> {
    return apiClient.get<InventoryStats>('reports/inventory');
  }

  async getTechnicianReports(startDate?: string, endDate?: string): Promise<TechnicianReport[]> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    return apiClient.get<TechnicianReport[]>('reports/technicians', params);
  }
}

interface WorkshopSettings {
  id: string;
  workshop_name: string;
  phone?: string;
  address?: string;
  email?: string;
  logo_url?: string;
  tax_number?: string;
  tax_rate?: number;
  tax_type?: string;
  currency?: string;
  created_at: string;
  updated_at: string;
}

class SettingsService {
  async getWorkshopSettings(): Promise<WorkshopSettings | null> {
    try {
      return await cache.fetchWithCache(
        CacheKeys.WORKSHOP_SETTINGS,
        () => apiClient.get<WorkshopSettings>('settings'),
        CacheTTL.LONG
      );
    } catch {
      return null;
    }
  }

  async updateWorkshopSettings(id: string, data: Partial<WorkshopSettings>): Promise<WorkshopSettings> {
    const result = await apiClient.put<WorkshopSettings>(`settings/${id}`, data);
    cache.remove(CacheKeys.WORKSHOP_SETTINGS);
    return result;
  }

  async createWorkshopSettings(data: Partial<WorkshopSettings>): Promise<WorkshopSettings> {
    const result = await apiClient.post<WorkshopSettings>('settings', data);
    cache.remove(CacheKeys.WORKSHOP_SETTINGS);
    return result;
  }

  invalidateCache(): void {
    cache.remove(CacheKeys.WORKSHOP_SETTINGS);
  }
}

import {
  DashboardBasicStats,
  DashboardFinancialStats,
  DashboardOpenOrders,
  DashboardOpenInvoices,
  DashboardInventoryAlerts,
  DashboardExpensesSummary,
  DashboardTechniciansPerformance,
  EnhancedDashboardData,
  DashboardPermissions,
} from '../types/dashboard';

class DashboardService {
  async getStats(userId: string, computedPermissions: string[]): Promise<DashboardBasicStats> {
    const isAdmin = computedPermissions.includes('admin');
    const hasFinancialStats = isAdmin || computedPermissions.includes('dashboard.view_financial_stats');

    const { data, error } = await supabase
      .from('dashboard_stats_cache')
      .select('*')
      .maybeSingle();

    if (error) throw new ApiError(error.message, 500);

    return {
      totalRevenue: hasFinancialStats ? parseFloat(data?.total_revenue || '0') : 0,
      completedOrders: data?.completed_work_orders || 0,
      activeCustomers: data?.total_customers || 0,
      activeTechnicians: data?.active_technicians || 0,
    };
  }

  async getEnhancedDashboard(userId: string, computedPermissions: string[]): Promise<EnhancedDashboardData> {
    const isAdmin = computedPermissions.includes('admin');

    const permissions: DashboardPermissions = {
      financialStats: isAdmin || computedPermissions.includes('dashboard.view_financial_stats'),
      openOrders: isAdmin || computedPermissions.includes('dashboard.view_open_orders'),
      openInvoices: isAdmin || computedPermissions.includes('dashboard.view_open_invoices'),
      inventoryAlerts: isAdmin || computedPermissions.includes('dashboard.view_inventory_alerts'),
      expenses: isAdmin || computedPermissions.includes('dashboard.view_expenses'),
      techniciansPerformance: isAdmin || computedPermissions.includes('dashboard.view_technicians_performance'),
      activities: isAdmin || computedPermissions.includes('dashboard.view_activities'),
    };

    const sections: any = {};

    if (permissions.financialStats) {
      sections.financialStats = await this.getFinancialStats();
    }

    if (permissions.openOrders) {
      sections.openOrders = await this.getOpenOrders();
    }

    if (permissions.openInvoices) {
      sections.openInvoices = await this.getOpenInvoices(permissions.financialStats);
    }

    if (permissions.inventoryAlerts) {
      sections.inventoryAlerts = await this.getInventoryAlerts();
    }

    if (permissions.expenses) {
      sections.expenses = await this.getExpensesSummary();
    }

    if (permissions.techniciansPerformance) {
      sections.techniciansPerformance = await this.getTechniciansPerformance();
    }

    return { sections, permissions };
  }

  async getFinancialStats(): Promise<DashboardFinancialStats> {
    const today = new Date().toISOString().split('T')[0];
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const weekStart = startOfWeek.toISOString().split('T')[0];
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const monthStart = startOfMonth.toISOString().split('T')[0];

    const [todayRev, weekRev, monthRev, todayExp] = await Promise.all([
      supabase
        .from('invoices')
        .select('total_amount')
        .eq('payment_status', 'paid')
        .gte('paid_at', today)
        .then(r => r.data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0),

      supabase
        .from('invoices')
        .select('total_amount')
        .eq('payment_status', 'paid')
        .gte('paid_at', weekStart)
        .then(r => r.data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0),

      supabase
        .from('invoices')
        .select('total_amount')
        .eq('payment_status', 'paid')
        .gte('paid_at', monthStart)
        .then(r => r.data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0),

      supabase
        .from('expenses')
        .select('amount')
        .gte('date', today)
        .then(r => r.data?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0),
    ]);

    return {
      todayRevenue: todayRev,
      weekRevenue: weekRev,
      monthRevenue: monthRev,
      todayExpenses: todayExp,
      netProfit: monthRev - todayExp,
    };
  }

  async getOpenOrders(): Promise<DashboardOpenOrders> {
    const { data: inProgress } = await supabase
      .from('work_orders_detailed')
      .select('*')
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: pending } = await supabase
      .from('work_orders_detailed')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    const { count } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress']);

    return {
      inProgress: inProgress || [],
      pending: pending || [],
      totalCount: count || 0,
    };
  }

  async getOpenInvoices(includeAmounts: boolean): Promise<DashboardOpenInvoices> {
    const { data: unpaid } = await supabase
      .from('invoices_detailed')
      .select('*')
      .eq('payment_status', 'unpaid')
      .order('created_at', { ascending: false })
      .limit(5);

    const today = new Date().toISOString().split('T')[0];
    const { data: overdue } = await supabase
      .from('invoices_detailed')
      .select('*')
      .eq('payment_status', 'unpaid')
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(5);

    let totalAmount = 0;
    let totalCount = 0;

    if (includeAmounts) {
      const { data: allUnpaid, count } = await supabase
        .from('invoices')
        .select('total_amount', { count: 'exact' })
        .eq('payment_status', 'unpaid');

      totalAmount = allUnpaid?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      totalCount = count || 0;
    }

    return {
      unpaidInvoices: unpaid || [],
      overdueInvoices: overdue || [],
      totalAmount,
      totalCount,
    };
  }

  async getInventoryAlerts(): Promise<DashboardInventoryAlerts> {
    const { data: outOfStock } = await supabase
      .from('spare_parts')
      .select('*')
      .eq('quantity', 0)
      .order('name', { ascending: true });

    const { data: lowStock } = await supabase
      .from('spare_parts')
      .select('*')
      .gt('quantity', 0)
      .filter('quantity', 'lt', 'minimum_quantity')
      .order('quantity', { ascending: true })
      .limit(10);

    const { count } = await supabase
      .from('spare_parts')
      .select('*', { count: 'exact', head: true })
      .filter('quantity', 'lte', 'minimum_quantity');

    return {
      outOfStock: outOfStock || [],
      lowStock: lowStock || [],
      totalLowStockItems: count || 0,
    };
  }

  async getExpensesSummary(): Promise<DashboardExpensesSummary> {
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const monthStart = startOfMonth.toISOString().split('T')[0];

    const { data: dueToday } = await supabase
      .from('expense_installments')
      .select(`
        *,
        expenses (
          expense_number,
          description,
          category
        )
      `)
      .eq('payment_status', 'pending')
      .lte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(5);

    const { data: monthlyExpenses } = await supabase
      .from('expenses')
      .select('amount, category')
      .gte('date', monthStart);

    const monthlyTotal = monthlyExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
    const byCategory: Record<string, number> = {};

    monthlyExpenses?.forEach(exp => {
      if (exp.category) {
        byCategory[exp.category] = (byCategory[exp.category] || 0) + (exp.amount || 0);
      }
    });

    return {
      dueToday: dueToday || [],
      monthlyTotal,
      byCategory,
    };
  }

  async getTechniciansPerformance(): Promise<DashboardTechniciansPerformance> {
    const { data: technicians, count } = await supabase
      .from('technicians')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(10);

    return {
      activeTechnicians: count || 0,
      technicians: technicians || [],
    };
  }

  async getDashboardPreferences(): Promise<any> {
    return apiClient.get('dashboard/preferences');
  }

  async saveDashboardPreferences(data: any): Promise<any> {
    return apiClient.post('dashboard/preferences', data);
  }
}

export const workOrdersService = new WorkOrdersService();
export const invoicesService = new InvoicesService();
export const customersService = new CustomersService();
export const vehiclesService = new VehiclesService();
export const techniciansService = new TechniciansService();
export const inventoryService = new InventoryService();
export const authService = new AuthService();
export const usersService = new UsersService();
export const salariesService = new SalariesService();
export const expensesService = new ExpensesService();
export const reportsService = new ReportsService();
export const settingsService = new SettingsService();
export const dashboardService = new DashboardService();

export { rolesService } from './rolesService';
export { permissionsService } from './permissionsService';

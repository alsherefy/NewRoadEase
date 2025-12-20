import { supabase } from '../lib/supabase';
import { User, UserPermission, Customer, Vehicle, WorkOrder, Invoice, Technician, Salary, SparePart, Expense } from '../types';
import type { User as SupabaseUser, Session, AuthChangeEvent } from '@supabase/supabase-js';

export class ServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  hasMore: boolean;
}

class WorkOrdersService {
  async getPaginatedWorkOrders(options: QueryOptions): Promise<PaginatedResponse<WorkOrder>> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const { data, error, count } = await supabase
      .from('work_orders')
      .select(`
        *,
        customer:customers(id, name, phone),
        vehicle:vehicles(id, car_make, car_model, plate_number)
      `, { count: 'exact' })
      .order(options.orderBy || 'created_at', { ascending: options.orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) throw new ServiceError(error.message);

    return {
      data: data || [],
      count: count || 0,
      hasMore: offset + limit < (count || 0)
    };
  }

  async deleteWorkOrder(id: string): Promise<void> {
    const { error } = await supabase.from('work_orders').delete().eq('id', id);
    if (error) throw new ServiceError(error.message);
  }
}

class InvoicesService {
  async getPaginatedInvoices(options: QueryOptions): Promise<PaginatedResponse<Invoice>> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const { data, error, count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .order(options.orderBy || 'created_at', { ascending: options.orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) throw new ServiceError(error.message);

    return {
      data: data || [],
      count: count || 0,
      hasMore: offset + limit < (count || 0)
    };
  }

  async deleteInvoice(id: string): Promise<void> {
    await supabase.from('invoice_items').delete().eq('invoice_id', id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw new ServiceError(error.message);
  }
}

class CustomersService {
  async getAllCustomers(options?: QueryOptions): Promise<Customer[]> {
    let query = supabase.from('customers').select('*');

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async getPaginatedCustomers(options: QueryOptions): Promise<PaginatedResponse<Customer>> {
    const limit = options.limit || 30;
    const offset = options.offset || 0;

    const { data, error, count } = await supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order(options.orderBy || 'created_at', { ascending: options.orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) throw new ServiceError(error.message);

    return {
      data: data || [],
      count: count || 0,
      hasMore: offset + limit < (count || 0)
    };
  }

  async createCustomer(data: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
    const { data: result, error } = await supabase
      .from('customers')
      .insert(data)
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const { data: result, error } = await supabase
      .from('customers')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw new ServiceError(error.message);
  }
}

class VehiclesService {
  async getVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async createVehicle(data: Omit<Vehicle, 'id' | 'created_at'>): Promise<Vehicle> {
    const { data: result, error } = await supabase
      .from('vehicles')
      .insert(data)
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const { data: result, error } = await supabase
      .from('vehicles')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async deleteVehicle(id: string): Promise<void> {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw new ServiceError(error.message);
  }
}

class TechniciansService {
  async getAllTechnicians(options?: QueryOptions): Promise<Technician[]> {
    let query = supabase.from('technicians').select('*');

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async getActiveTechnicians(): Promise<Technician[]> {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw new ServiceError(error.message);
    return data || [];
  }
}

class InventoryService {
  async getAllSpareParts(options?: QueryOptions): Promise<SparePart[]> {
    let query = supabase.from('spare_parts').select('*');

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async createSparePart(data: Omit<SparePart, 'id' | 'created_at' | 'updated_at'>): Promise<SparePart> {
    const { data: result, error } = await supabase
      .from('spare_parts')
      .insert(data)
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async updateSparePart(id: string, data: Partial<SparePart>): Promise<SparePart> {
    const { data: result, error } = await supabase
      .from('spare_parts')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async deleteSparePart(id: string): Promise<void> {
    const { error } = await supabase.from('spare_parts').delete().eq('id', id);
    if (error) throw new ServiceError(error.message);
  }
}

class AuthService {
  async signIn(email: string, password: string): Promise<{ user: SupabaseUser; session: Session }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new ServiceError(error.message);
    if (!data.user || !data.session) throw new ServiceError('No user or session returned');
    return { user: data.user, session: data.session };
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new ServiceError(error.message);
  }

  async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  async getUserProfile(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new ServiceError(error.message);
    return data;
  }
}

class UsersService {
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select(`*, permissions:user_permissions(*)`)
      .order('created_at', { ascending: false });

    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const { data: result, error } = await supabase
      .from('users')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw new ServiceError(error.message);
  }

  async updatePermissions(userId: string, permissions: Array<{ permission_key: string; can_view: boolean; can_edit: boolean }>): Promise<void> {
    await supabase.from('user_permissions').delete().eq('user_id', userId);

    const permissionsToInsert = permissions
      .filter(p => p.can_view || p.can_edit)
      .map(p => ({ user_id: userId, ...p }));

    if (permissionsToInsert.length > 0) {
      const { error } = await supabase.from('user_permissions').insert(permissionsToInsert);
      if (error) throw new ServiceError(error.message);
    }
  }
}

class SalariesService {
  async getAllSalaries(options?: QueryOptions): Promise<Salary[]> {
    let query = supabase.from('salaries').select(`*, technician:technicians(*)`);

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async getSalariesByTechnician(technicianId: string): Promise<Salary[]> {
    const { data, error } = await supabase
      .from('salaries')
      .select(`*, technician:technicians(*)`)
      .eq('technician_id', technicianId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async createSalary(data: Omit<Salary, 'id' | 'created_at' | 'updated_at' | 'salary_number'>): Promise<Salary> {
    const { data: salaryNumber } = await supabase.rpc('generate_salary_number');

    const { data: result, error } = await supabase
      .from('salaries')
      .insert({ ...data, salary_number: salaryNumber })
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async updateSalary(id: string, data: Partial<Salary>): Promise<Salary> {
    const { data: result, error } = await supabase
      .from('salaries')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async deleteSalary(id: string): Promise<void> {
    const { error } = await supabase.from('salaries').delete().eq('id', id);
    if (error) throw new ServiceError(error.message);
  }
}

class ExpensesService {
  async getAllExpenses(options?: QueryOptions): Promise<Expense[]> {
    let query = supabase.from('expenses').select('*');

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection === 'asc' });
    } else {
      query = query.order('expense_date', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async createExpense(data: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'expense_number'>): Promise<Expense> {
    const { data: expenseNumber } = await supabase.rpc('generate_expense_number');

    const { data: result, error } = await supabase
      .from('expenses')
      .insert({ ...data, expense_number: expenseNumber })
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
    const { data: result, error } = await supabase
      .from('expenses')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ServiceError(error.message);
    return result;
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new ServiceError(error.message);
  }

  async getExpenseInstallments(expenseId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('expense_installments')
      .select('*')
      .eq('expense_id', expenseId)
      .order('installment_number');

    if (error) throw new ServiceError(error.message);
    return data || [];
  }

  async updateInstallment(id: string, data: { is_paid: boolean; paid_date?: string }): Promise<void> {
    const { error } = await supabase
      .from('expense_installments')
      .update(data)
      .eq('id', id);
    if (error) throw new ServiceError(error.message);
  }
}

class ReportsService {
  async getOverviewStats(startDate?: string, endDate?: string) {
    let workOrdersQuery = supabase.from('work_orders').select('*');
    let invoicesQuery = supabase.from('invoices').select('*');

    if (startDate) {
      workOrdersQuery = workOrdersQuery.gte('created_at', startDate);
      invoicesQuery = invoicesQuery.gte('created_at', startDate);
    }
    if (endDate) {
      workOrdersQuery = workOrdersQuery.lte('created_at', endDate);
      invoicesQuery = invoicesQuery.lte('created_at', endDate);
    }

    const [workOrdersResult, invoicesResult, sparePartsResult, allSparePartsResult] = await Promise.all([
      workOrdersQuery,
      invoicesQuery,
      supabase.from('work_order_spare_parts').select('quantity, unit_price'),
      supabase.from('spare_parts').select('*'),
    ]);

    const workOrders = workOrdersResult.data || [];
    const invoices = invoicesResult.data || [];
    const sparePartsSold = sparePartsResult.data || [];
    const allSpareParts = allSparePartsResult.data || [];

    const completedOrders = workOrders.filter(wo => wo.status === 'completed').length;
    const pendingOrders = workOrders.filter(wo => wo.status === 'pending').length;
    const inProgressOrders = workOrders.filter(wo => wo.status === 'in_progress').length;

    const paidInvoices = invoices.filter(inv => inv.payment_status === 'paid').length;
    const unpaidInvoices = invoices.filter(inv => inv.payment_status === 'unpaid' || inv.payment_status === 'partial').length;

    const totalRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    const sparePartsRevenue = sparePartsSold.reduce((sum, sp) => sum + (sp.quantity * sp.unit_price), 0);
    const totalSparePartsSold = sparePartsSold.reduce((sum, sp) => sum + sp.quantity, 0);

    const lowStockItems = allSpareParts.filter(sp => sp.quantity <= sp.minimum_quantity).length;

    return {
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
    };
  }

  async getInventoryStats() {
    const { data: spareParts, error } = await supabase.from('spare_parts').select('*');
    if (error) throw new ServiceError(error.message);

    const totalValue = (spareParts || []).reduce((sum, sp) => sum + (sp.quantity * Number(sp.unit_price)), 0);
    const lowStockItems = (spareParts || []).filter(sp => sp.quantity <= sp.minimum_quantity);

    return {
      totalItems: (spareParts || []).length,
      totalValue,
      lowStockItems: lowStockItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        minimum_quantity: item.minimum_quantity,
      })),
    };
  }

  async getTechnicianReports(startDate?: string, endDate?: string) {
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('*')
      .eq('is_active', true);

    if (techError) throw new ServiceError(techError.message);

    const reports = [];

    for (const technician of technicians || []) {
      let query = supabase
        .from('technician_assignments')
        .select(`
          *,
          service:work_order_services!inner(
            *,
            work_order:work_orders!inner(status, created_at)
          )
        `)
        .eq('technician_id', technician.id)
        .eq('service.work_order.status', 'completed');

      if (startDate) {
        query = query.gte('service.work_order.created_at', startDate);
      }
      if (endDate) {
        query = query.lte('service.work_order.created_at', endDate);
      }

      const { data: assignments } = await query;

      const totalRevenue = (assignments || []).reduce((sum, a) => sum + (a.share_amount || 0), 0);
      const jobsCompleted = (assignments || []).length;
      const averageJobValue = jobsCompleted > 0 ? totalRevenue / jobsCompleted : 0;

      let totalEarnings = 0;
      if (technician.contract_type === 'percentage') {
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
          service_type: a.service?.service_type || '',
          description: a.service?.description || '',
          share_amount: a.share_amount,
          created_at: a.service?.work_order?.created_at || '',
        })),
      });
    }

    return reports.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }
}

class SettingsService {
  async getWorkshopSettings() {
    const { data, error } = await supabase
      .from('workshop_settings')
      .select('*')
      .maybeSingle();

    if (error) throw new ServiceError(error.message);
    return data;
  }

  async updateWorkshopSettings(id: string, data: any) {
    const { data: result, error } = await supabase
      .from('workshop_settings')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new ServiceError(error.message);
    return result;
  }

  async createWorkshopSettings(data: any) {
    const { data: result, error } = await supabase
      .from('workshop_settings')
      .insert(data)
      .select()
      .single();

    if (error) throw new ServiceError(error.message);
    return result;
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

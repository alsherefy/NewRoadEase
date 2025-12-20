import { supabase } from '../lib/supabase';
import { apiClient, ApiError } from './apiClient';
import { User, UserPermission, Customer, Vehicle, WorkOrder, Invoice, Technician, Salary, SparePart, Expense } from '../types';
import type { User as SupabaseUser, Session, AuthChangeEvent } from '@supabase/supabase-js';

export { ApiError as ServiceError } from './apiClient';

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
    const params: Record<string, string> = {};
    if (options.limit) params.limit = String(options.limit);
    if (options.offset) params.offset = String(options.offset);
    if (options.orderBy) params.orderBy = options.orderBy;
    if (options.orderDirection) params.orderDir = options.orderDirection;

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
    return apiClient.get<Technician[]>('technicians', { activeOnly: 'true' });
  }

  async getTechnicianById(id: string): Promise<Technician> {
    return apiClient.get<Technician>(`technicians/${id}`);
  }

  async createTechnician(data: Omit<Technician, 'id' | 'created_at' | 'updated_at'>): Promise<Technician> {
    return apiClient.post<Technician>('technicians', data);
  }

  async updateTechnician(id: string, data: Partial<Technician>): Promise<Technician> {
    return apiClient.put<Technician>(`technicians/${id}`, data);
  }

  async deleteTechnician(id: string): Promise<void> {
    await apiClient.delete(`technicians/${id}`);
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
    return apiClient.get<UserPermission[]>(`users/${userId}/permissions`);
  }

  async getAllUsers(): Promise<User[]> {
    return apiClient.get<User[]>('users');
  }

  async getUserById(id: string): Promise<User> {
    return apiClient.get<User>(`users/${id}`);
  }

  async createUser(data: { email: string; password: string; name: string; role?: string }): Promise<User> {
    return apiClient.post<User>('users/create', data);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return apiClient.put<User>(`users/${id}`, data);
  }

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`users/${id}`);
  }

  async updatePermissions(userId: string, permissions: Array<{ permission_key: string; can_view: boolean; can_edit: boolean }>): Promise<void> {
    await apiClient.put(`users/${userId}/permissions`, { permissions });
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
      return await apiClient.get<WorkshopSettings>('settings');
    } catch {
      return null;
    }
  }

  async updateWorkshopSettings(id: string, data: Partial<WorkshopSettings>): Promise<WorkshopSettings> {
    return apiClient.put<WorkshopSettings>(`settings/${id}`, data);
  }

  async createWorkshopSettings(data: Partial<WorkshopSettings>): Promise<WorkshopSettings> {
    return apiClient.post<WorkshopSettings>('settings', data);
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

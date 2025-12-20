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
}

export const workOrdersService = new WorkOrdersService();
export const invoicesService = new InvoicesService();
export const customersService = new CustomersService();
export const vehiclesService = new VehiclesService();
export const techniciansService = new TechniciansService();
export const inventoryService = new InventoryService();
export const authService = new AuthService();
export const usersService = new UsersService();

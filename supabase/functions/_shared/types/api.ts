export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthContext {
  user_id: string;
  email: string;
  full_name: string;
  organization_id: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  vin?: string;
  color?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  work_order_number: string;
  customer_id: string;
  vehicle_id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  assigned_technician_id?: string;
  estimated_cost?: number;
  actual_cost?: number;
  notes?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  work_order_id: string;
  customer_id: string;
  vehicle_id: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_percentage?: number;
  discount_amount?: number;
  total: number;
  payment_status: 'pending' | 'partial' | 'paid';
  paid_amount: number;
  payment_method?: string;
  card_type?: string;
  tax_type?: string;
  notes?: string;
  organization_id: string;
  paid_at?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  service_type?: 'service' | 'spare_part';
  spare_part_id?: string;
  created_at: string;
}

export interface SparePart {
  id: string;
  part_number: string;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  minimum_quantity: number;
  unit_price: number;
  supplier?: string;
  location?: string;
  organization_id: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  payment_method?: string;
  notes?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  email?: string;
  specialization: string;
  salary: number;
  hire_date: string;
  is_active: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  organization_id: string;
  key: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
  created_at: string;
}

export interface DashboardStats {
  work_orders: {
    pending: number;
    in_progress: number;
    completed_month: number;
    new_week: number;
  };
  invoices: {
    pending_count: number;
    partial_count: number;
    pending_amount: number;
    revenue_month: number;
    revenue_week: number;
  };
  customers: {
    total: number;
    new_month: number;
  };
  inventory: {
    low_stock: number;
    out_of_stock: number;
  };
  expenses: {
    month: number;
    week: number;
  };
  technicians: {
    active: number;
  };
  profit: {
    month: number;
    week: number;
  };
}

export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}
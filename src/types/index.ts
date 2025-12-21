export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  car_make: string;
  car_model: string;
  car_year: number;
  plate_number: string;
  notes?: string;
  created_at: string;
  customer?: Customer;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  specialization: string;
  contract_type: 'percentage' | 'fixed';
  percentage: number;
  fixed_salary: number;
  monthly_salary: number;
  commission_rate: number;
  allowances: number;
  is_active: boolean;
  created_at: string;
}

export interface WorkOrder {
  id: string;
  customer_id: string;
  vehicle_id: string;
  order_number: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  description?: string;
  total_labor_cost: number;
  created_at: string;
  completed_at?: string;
  customer?: Customer;
  vehicle?: Vehicle;
}

export interface WorkOrderService {
  id: string;
  work_order_id: string;
  service_type: string;
  description: string;
  labor_cost: number;
  created_at: string;
}

export interface TechnicianAssignment {
  id: string;
  service_id: string;
  technician_id: string;
  share_amount: number;
  created_at: string;
  technician?: Technician;
}

export interface SparePart {
  id: string;
  part_number: string;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  unit_price: number;
  minimum_quantity: number;
  supplier?: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  work_order_id: string;
  invoice_number: string;
  customer_id: string;
  vehicle_id: string;
  subtotal: number;
  discount_percentage: number;
  discount_amount: number;
  tax_rate: number;
  tax_type: 'inclusive' | 'exclusive';
  tax_amount: number;
  total: number;
  paid_amount: number;
  payment_status: 'paid' | 'unpaid' | 'partial';
  payment_method: 'cash' | 'card';
  card_type?: 'mada' | 'visa';
  notes?: string;
  created_at: string;
  customer?: Customer;
  vehicle?: Vehicle;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_type: 'service' | 'part';
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  spare_part_id?: string;
  created_at: string;
  spare_part?: SparePart;
}

export interface WorkOrderSparePart {
  id: string;
  work_order_id: string;
  spare_part_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
  spare_part?: SparePart;
}

export interface TechnicianPerformance {
  technician_id: string;
  technician_name: string;
  total_revenue: number;
  total_earnings: number;
  jobs_completed: number;
  average_job_value: number;
  revenue_percentage: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_roles?: UserRole[];
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission_key: PermissionKey;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
}

export type PermissionKey =
  | 'dashboard'
  | 'customers'
  | 'work_orders'
  | 'invoices'
  | 'inventory'
  | 'technicians'
  | 'reports'
  | 'settings'
  | 'users'
  | 'expenses'
  | 'salaries';

export interface UserWithPermissions extends User {
  permissions: UserPermission[];
}

export interface Expense {
  id: string;
  expense_number: string;
  category: 'salaries' | 'maintenance' | 'materials' | 'rent' | 'electricity' | 'water' | 'fuel' | 'other';
  description: string;
  amount: number;
  payment_method: 'cash' | 'card' | 'bank_transfer';
  card_type?: 'mada' | 'visa';
  receipt_number?: string;
  notes?: string;
  expense_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Salary {
  id: string;
  salary_number: string;
  technician_id: string;
  month: number;
  year: number;
  basic_salary: number;
  commission_amount: number;
  bonus: number;
  deductions: number;
  total_salary: number;
  work_orders_count: number;
  total_work_orders_value: number;
  payment_status: 'paid' | 'unpaid' | 'partial';
  paid_amount: number;
  payment_method?: 'cash' | 'card' | 'bank_transfer';
  card_type?: 'mada' | 'visa';
  payment_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  technician?: Technician;
}

// RBAC System Types

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  name_en: string;
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
  key: string;
  resource: string;
  action: string;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  category: PermissionCategory;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  granted_by?: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by?: string;
  created_at: string;
  role?: Role;
}

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  permission_id: string;
  is_granted: boolean;
  reason?: string;
  granted_by?: string;
  expires_at?: string;
  created_at: string;
  permission?: Permission;
}

export interface RBACUser extends User {
  user_roles?: UserRole[];
  computed_permissions?: string[];
  permission_overrides?: UserPermissionOverride[];
}

export interface RoleWithPermissions extends Role {
  permissions?: Permission[];
  users_count?: number;
}

export type PermissionCategory = 'general' | 'operations' | 'financial' | 'reports' | 'administration';

export type ResourceType =
  | 'dashboard'
  | 'customers'
  | 'vehicles'
  | 'work_orders'
  | 'invoices'
  | 'inventory'
  | 'expenses'
  | 'salaries'
  | 'technicians'
  | 'reports'
  | 'settings'
  | 'users'
  | 'roles'
  | 'audit_logs';

export type ActionType =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'print'
  | 'approve'
  | 'cancel'
  | 'complete'
  | 'void'
  | 'adjust_stock'
  | 'view_performance'
  | 'manage_assignments'
  | 'financial'
  | 'operations'
  | 'performance'
  | 'manage_workshop'
  | 'manage_tax'
  | 'manage_roles'
  | 'manage_permissions'
  | 'change_password';

export type DetailedPermissionKey =
  | 'dashboard.view'
  | 'customers.view'
  | 'customers.create'
  | 'customers.update'
  | 'customers.delete'
  | 'customers.export'
  | 'vehicles.view'
  | 'vehicles.create'
  | 'vehicles.update'
  | 'vehicles.delete'
  | 'work_orders.view'
  | 'work_orders.create'
  | 'work_orders.update'
  | 'work_orders.delete'
  | 'work_orders.cancel'
  | 'work_orders.complete'
  | 'work_orders.export'
  | 'invoices.view'
  | 'invoices.create'
  | 'invoices.update'
  | 'invoices.delete'
  | 'invoices.print'
  | 'invoices.export'
  | 'invoices.void'
  | 'inventory.view'
  | 'inventory.create'
  | 'inventory.update'
  | 'inventory.delete'
  | 'inventory.adjust_stock'
  | 'inventory.export'
  | 'expenses.view'
  | 'expenses.create'
  | 'expenses.update'
  | 'expenses.delete'
  | 'expenses.approve'
  | 'expenses.export'
  | 'salaries.view'
  | 'salaries.create'
  | 'salaries.update'
  | 'salaries.delete'
  | 'salaries.approve'
  | 'salaries.export'
  | 'technicians.view'
  | 'technicians.create'
  | 'technicians.update'
  | 'technicians.delete'
  | 'technicians.view_performance'
  | 'technicians.manage_assignments'
  | 'reports.view'
  | 'reports.export'
  | 'reports.financial'
  | 'reports.operations'
  | 'reports.performance'
  | 'settings.view'
  | 'settings.update'
  | 'settings.manage_workshop'
  | 'settings.manage_tax'
  | 'users.view'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'users.manage_roles'
  | 'users.manage_permissions'
  | 'users.change_password'
  | 'roles.view'
  | 'roles.create'
  | 'roles.update'
  | 'roles.delete'
  | 'roles.manage_permissions'
  | 'audit_logs.view';

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

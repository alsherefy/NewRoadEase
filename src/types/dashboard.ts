import { Invoice, SparePart, Technician, WorkOrder } from './index';

export interface DashboardBasicStats {
  totalRevenue: number;
  completedOrders: number;
  activeCustomers: number;
  activeTechnicians: number;
}

export interface DashboardFinancialStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  todayExpenses: number;
  netProfit: number;
}

export interface DashboardWorkOrder {
  id: string;
  order_number: string;
  status: string;
  priority?: string;
  description?: string;
  total_labor_cost: string;
  created_at: string;
  completed_at?: string;
  updated_at: string;
  organization_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  vehicle_id: string;
  plate_number: string;
  car_make: string;
  car_model: string;
  car_year: number;
  technician_count: number;
  total_spare_parts_cost: string;
  total_cost: string;
  invoice_payment_status?: string;
}

export interface DashboardOpenOrders {
  inProgress: DashboardWorkOrder[];
  pending: DashboardWorkOrder[];
  totalCount: number;
}

export interface DashboardInvoice {
  id: string;
  invoice_number: string;
  work_order_id: string;
  payment_status: string;
  payment_method?: string;
  card_type?: string;
  subtotal: string;
  discount_percentage: string;
  discount_amount: string;
  tax_type: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  paid_amount: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  paid_at?: string;
  due_date?: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  vehicle_id: string;
  plate_number: string;
  car_make: string;
  car_model: string;
  car_year: number;
  work_order_number: string;
  work_order_status: string;
  work_order_description?: string;
  remaining_amount: string;
  items_count: number;
}

export interface DashboardOpenInvoices {
  unpaidInvoices: DashboardInvoice[];
  overdueInvoices: DashboardInvoice[];
  totalAmount: number;
  totalCount: number;
}

export interface DashboardInventoryAlerts {
  outOfStock: SparePart[];
  lowStock: SparePart[];
  totalLowStockItems: number;
}

export interface DashboardExpenseInstallment {
  id: string;
  expense_id: string;
  amount: number;
  due_date: string;
  payment_status: string;
  expenses: {
    expense_number: string;
    description: string;
    category: string;
  };
}

export interface DashboardExpensesSummary {
  dueToday: DashboardExpenseInstallment[];
  monthlyTotal: number;
  byCategory: Record<string, number>;
}

export interface DashboardTechniciansPerformance {
  activeTechnicians: number;
  technicians: Technician[];
}

export interface DashboardPermissions {
  financialStats: boolean;
  openOrders: boolean;
  openInvoices: boolean;
  inventoryAlerts: boolean;
  expenses: boolean;
  techniciansPerformance: boolean;
  activities: boolean;
}

export interface DashboardSections {
  financialStats?: DashboardFinancialStats;
  openOrders?: DashboardOpenOrders;
  openInvoices?: DashboardOpenInvoices;
  inventoryAlerts?: DashboardInventoryAlerts;
  expenses?: DashboardExpensesSummary;
  techniciansPerformance?: DashboardTechniciansPerformance;
}

export interface EnhancedDashboardData {
  sections: DashboardSections;
  permissions: DashboardPermissions;
}

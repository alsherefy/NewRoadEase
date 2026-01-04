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

export interface DashboardWorkOrder extends WorkOrder {
  customers: {
    id: string;
    name: string;
    phone: string;
  };
  vehicles: {
    id: string;
    car_make: string;
    car_model: string;
    plate_number: string;
  };
}

export interface DashboardOpenOrders {
  inProgress: DashboardWorkOrder[];
  pending: DashboardWorkOrder[];
  totalCount: number;
}

export interface DashboardInvoice extends Invoice {
  customers: {
    id: string;
    name: string;
    phone: string;
  };
  vehicles: {
    id: string;
    car_make: string;
    car_model: string;
    plate_number: string;
  };
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

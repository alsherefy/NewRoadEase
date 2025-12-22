export const RESOURCES = {
  DASHBOARD: "dashboard",
  CUSTOMERS: "customers",
  VEHICLES: "vehicles",
  TECHNICIANS: "technicians",
  WORK_ORDERS: "work_orders",
  INVOICES: "invoices",
  INVENTORY: "inventory",
  EXPENSES: "expenses",
  REPORTS: "reports",
  SETTINGS: "settings",
  USERS: "users",
} as const;

export type Resource = typeof RESOURCES[keyof typeof RESOURCES];
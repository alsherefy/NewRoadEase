export const RESOURCES = {
  CUSTOMERS: 'customers',
  WORK_ORDERS: 'work_orders',
  INVOICES: 'invoices',
  INVENTORY: 'spare_parts',
  TECHNICIANS: 'technicians',
  USERS: 'users',
  EXPENSES: 'expenses',
  SALARIES: 'salaries',
  SETTINGS: 'workshop_settings',
  VEHICLES: 'vehicles',
  REPORTS: 'reports',
} as const;

export type ResourceKey = typeof RESOURCES[keyof typeof RESOURCES];

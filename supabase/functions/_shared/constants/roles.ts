/**
 * Centralized Role and Permission Definitions
 * Single source of truth for the authorization system
 */

export const ROLES = {
  ADMIN: 'admin',
  CUSTOMER_SERVICE: 'customer_service',
  RECEPTIONIST: 'receptionist',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ALL_ROLES: Role[] = [
  ROLES.ADMIN,
  ROLES.CUSTOMER_SERVICE,
  ROLES.RECEPTIONIST,
] as const;

export const PERMISSION_KEYS = {
  DASHBOARD: 'dashboard',
  CUSTOMERS: 'customers',
  WORK_ORDERS: 'work_orders',
  INVOICES: 'invoices',
  INVENTORY: 'inventory',
  TECHNICIANS: 'technicians',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  USERS: 'users',
  EXPENSES: 'expenses',
  SALARIES: 'salaries',
} as const;

export type PermissionKey = typeof PERMISSION_KEYS[keyof typeof PERMISSION_KEYS];

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  PERMISSION_KEYS.DASHBOARD,
  PERMISSION_KEYS.CUSTOMERS,
  PERMISSION_KEYS.WORK_ORDERS,
  PERMISSION_KEYS.INVOICES,
  PERMISSION_KEYS.INVENTORY,
  PERMISSION_KEYS.TECHNICIANS,
  PERMISSION_KEYS.REPORTS,
  PERMISSION_KEYS.SETTINGS,
  PERMISSION_KEYS.USERS,
  PERMISSION_KEYS.EXPENSES,
  PERMISSION_KEYS.SALARIES,
] as const;

export type PermissionAction = 'view' | 'edit';

export interface Permission {
  resource: PermissionKey;
  can_view: boolean;
  can_edit: boolean;
}

/**
 * Default Permission Mappings for Each Role
 * Defines baseline permissions that can be customized per user
 */

import { ROLES, PERMISSION_KEYS, Permission } from "../_shared/constants/roles.ts";

export const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  [ROLES.ADMIN]: [
    { resource: PERMISSION_KEYS.DASHBOARD, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.CUSTOMERS, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.WORK_ORDERS, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.INVOICES, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.INVENTORY, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.TECHNICIANS, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.REPORTS, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.SETTINGS, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.USERS, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.EXPENSES, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.SALARIES, can_view: true, can_edit: true },
  ],
  [ROLES.CUSTOMER_SERVICE]: [
    { resource: PERMISSION_KEYS.DASHBOARD, can_view: true, can_edit: false },
    { resource: PERMISSION_KEYS.CUSTOMERS, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.WORK_ORDERS, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.INVOICES, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.INVENTORY, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.TECHNICIANS, can_view: true, can_edit: false },
    { resource: PERMISSION_KEYS.REPORTS, can_view: true, can_edit: false },
    { resource: PERMISSION_KEYS.SETTINGS, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.USERS, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.EXPENSES, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.SALARIES, can_view: false, can_edit: false },
  ],
  [ROLES.RECEPTIONIST]: [
    { resource: PERMISSION_KEYS.DASHBOARD, can_view: true, can_edit: false },
    { resource: PERMISSION_KEYS.CUSTOMERS, can_view: true, can_edit: true },
    { resource: PERMISSION_KEYS.WORK_ORDERS, can_view: true, can_edit: false },
    { resource: PERMISSION_KEYS.INVOICES, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.INVENTORY, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.TECHNICIANS, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.REPORTS, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.SETTINGS, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.USERS, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.EXPENSES, can_view: false, can_edit: false },
    { resource: PERMISSION_KEYS.SALARIES, can_view: false, can_edit: false },
  ],
};
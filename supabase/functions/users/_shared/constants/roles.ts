export const ROLES = {
  ADMIN: "admin" as const,
  CUSTOMER_SERVICE: "customer_service" as const,
  RECEPTIONIST: "receptionist" as const,
};

export type Role = typeof ROLES[keyof typeof ROLES];

export const ALL_ROLES: Role[] = [
  ROLES.ADMIN,
  ROLES.CUSTOMER_SERVICE,
  ROLES.RECEPTIONIST,
];

export type PermissionKey =
  | "dashboard"
  | "customers"
  | "technicians"
  | "work_orders"
  | "invoices"
  | "inventory"
  | "expenses"
  | "reports"
  | "settings"
  | "users";

export interface Permission {
  resource: string;
  can_view: boolean;
  can_edit: boolean;
}
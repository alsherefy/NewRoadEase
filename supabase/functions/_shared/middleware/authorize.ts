import { JWTPayload, ForbiddenError } from "../types.ts";
import { Role, PermissionKey, ROLES } from "../constants/roles.ts";

export function requireRole(user: JWTPayload, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Access denied. Required role: ${allowedRoles.join(" or ")}`
    );
  }
}

export function allRoles(user: JWTPayload): void {
  return;
}

export function adminOnly(user: JWTPayload): void {
  requireRole(user, [ROLES.ADMIN]);
}

export function adminOrCustomerService(user: JWTPayload): void {
  requireRole(user, [ROLES.ADMIN, ROLES.CUSTOMER_SERVICE]);
}

export function hasPermission(
  user: JWTPayload,
  resource: PermissionKey,
  requireEdit: boolean = false
): boolean {
  if (user.role === ROLES.ADMIN) {
    return true;
  }

  if (!user.permissions) {
    return false;
  }

  const permission = user.permissions.find((p) => p.resource === resource);
  if (!permission) {
    return false;
  }

  if (requireEdit) {
    return permission.can_edit;
  }

  return permission.can_view;
}

export function requirePermission(
  user: JWTPayload,
  resource: PermissionKey,
  requireEdit: boolean = false
): void {
  if (!hasPermission(user, resource, requireEdit)) {
    throw new ForbiddenError(
      `Insufficient permissions for resource: ${resource}`
    );
  }
}
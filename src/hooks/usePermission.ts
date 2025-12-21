import { useAuth } from '../contexts/AuthContext';
import type { DetailedPermissionKey, PermissionKey } from '../types';

export function usePermission() {
  const {
    hasPermission,
    hasDetailedPermission,
    hasAnyPermission,
    hasRole,
    isAdmin,
    computedPermissions,
    userRoles,
  } = useAuth();

  const can = (permission: DetailedPermissionKey): boolean => {
    return hasDetailedPermission(permission);
  };

  const canView = (resource: PermissionKey): boolean => {
    return hasPermission(resource, false);
  };

  const canEdit = (resource: PermissionKey): boolean => {
    return hasPermission(resource, true);
  };

  const canCreate = (resource: PermissionKey): boolean => {
    return hasDetailedPermission(`${resource}.create` as DetailedPermissionKey);
  };

  const canUpdate = (resource: PermissionKey): boolean => {
    return hasDetailedPermission(`${resource}.update` as DetailedPermissionKey);
  };

  const canDelete = (resource: PermissionKey): boolean => {
    return hasDetailedPermission(`${resource}.delete` as DetailedPermissionKey);
  };

  const canExport = (resource: PermissionKey): boolean => {
    return hasDetailedPermission(`${resource}.export` as DetailedPermissionKey);
  };

  const canAny = (permissions: DetailedPermissionKey[]): boolean => {
    return hasAnyPermission(permissions);
  };

  const canAll = (permissions: DetailedPermissionKey[]): boolean => {
    if (isAdmin()) return true;
    return permissions.every(p => hasDetailedPermission(p));
  };

  return {
    can,
    canView,
    canEdit,
    canCreate,
    canUpdate,
    canDelete,
    canExport,
    canAny,
    canAll,
    hasPermission,
    hasDetailedPermission,
    hasAnyPermission,
    hasRole,
    isAdmin,
    computedPermissions,
    userRoles,
  };
}

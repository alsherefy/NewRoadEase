import { ReactNode } from 'react';
import { usePermission } from '../hooks/usePermission';
import type { DetailedPermissionKey } from '../types';

interface ProtectedActionProps {
  permission: DetailedPermissionKey | DetailedPermissionKey[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function ProtectedAction({
  permission,
  requireAll = false,
  fallback = null,
  children,
}: ProtectedActionProps) {
  const { can, canAny, canAll, isAdmin } = usePermission();

  if (isAdmin()) {
    return <>{children}</>;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];

  let hasAccess = false;

  if (requireAll) {
    hasAccess = canAll(permissions);
  } else if (permissions.length === 1) {
    hasAccess = can(permissions[0]);
  } else {
    hasAccess = canAny(permissions);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

import { JWTPayload } from "../types.ts";

export function applyRoleBasedFilter<T>(
  query: T,
  user: JWTPayload,
  _tableName?: string
): T {
  if (user.role === 'admin') {
    return query;
  }

  if (user.role === 'staff' || user.role === 'user') {
    (query as any).eq('organization_id', user.organizationId);
  }

  return query;
}

export function getOrganizationId(user: JWTPayload, providedOrgId?: string): string {
  if (user.role === 'admin' && providedOrgId) {
    return providedOrgId;
  }

  return user.organizationId;
}

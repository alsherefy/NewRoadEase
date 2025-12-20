import { JWTPayload } from "../types.ts";

export function applyRoleBasedFilter<T>(
  query: T,
  user: JWTPayload,
  _tableName?: string
): T {
  (query as any).eq('organization_id', user.organizationId);
  return query;
}

export function getOrganizationId(user: JWTPayload, providedOrgId?: string): string {
  return user.organizationId;
}

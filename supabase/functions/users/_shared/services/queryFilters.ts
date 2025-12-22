import { JWTPayload } from "../types.ts";
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export function applyOrganizationFilter<T>(
  query: any,
  user: JWTPayload
): any {
  return query.eq("organization_id", user.organizationId);
}

export function applyPaginationFilters(
  query: any,
  page: number = 1,
  limit: number = 50
): any {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return query.range(from, to);
}
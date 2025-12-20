import { createClient } from "npm:@supabase/supabase-js@2";
import { JWTPayload, ForbiddenError, NotFoundError } from "../types.ts";
import { Role, ROLES, PermissionKey, PermissionAction } from "../constants/roles.ts";
import { ResourceKey } from "../constants/resources.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function authorize(allowedRoles: Role[]) {
  return (user: JWTPayload) => {
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      );
    }
  };
}

export const adminOnly = authorize([ROLES.ADMIN]);
export const adminAndCustomerService = authorize([ROLES.ADMIN, ROLES.CUSTOMER_SERVICE]);
export const allRoles = authorize([ROLES.ADMIN, ROLES.CUSTOMER_SERVICE, ROLES.RECEPTIONIST]);

export function authorizePermission(
  user: JWTPayload,
  resource: PermissionKey,
  action: PermissionAction
): void {
  if (user.role === ROLES.ADMIN) {
    return;
  }

  if (!user.permissions || user.permissions.length === 0) {
    throw new ForbiddenError(`Access denied. No permissions found for resource: ${resource}`);
  }

  const permission = user.permissions.find(p => p.resource === resource);

  if (!permission) {
    throw new ForbiddenError(`Access denied. No permissions found for resource: ${resource}`);
  }

  if (action === 'view' && !permission.can_view) {
    throw new ForbiddenError(`Access denied. View permission required for resource: ${resource}`);
  }

  if (action === 'edit' && !permission.can_edit) {
    throw new ForbiddenError(`Access denied. Edit permission required for resource: ${resource}`);
  }
}

export function authorizeDelete(user: JWTPayload): void {
  if (user.role !== ROLES.ADMIN) {
    throw new ForbiddenError("Access denied. Only administrators can delete resources.");
  }
}

export async function checkOwnership(
  user: JWTPayload,
  tableName: ResourceKey,
  recordId: string
): Promise<void> {
  if (user.role === ROLES.ADMIN) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from(tableName)
    .select("organization_id")
    .eq("id", recordId)
    .maybeSingle();

  if (error) {
    throw new ForbiddenError(`Error verifying ownership: ${error.message}`);
  }

  if (!data) {
    throw new NotFoundError(`Resource not found in ${tableName}`);
  }

  if (data.organization_id !== user.organizationId) {
    throw new ForbiddenError(
      "Access denied. You can only modify resources belonging to your organization."
    );
  }
}

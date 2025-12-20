import { createClient } from "npm:@supabase/supabase-js@2";
import { JWTPayload, ForbiddenError } from "../types.ts";
import { Role, ROLES, PermissionKey, PermissionAction } from "../constants/roles.ts";

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

export async function authorizePermission(
  user: JWTPayload,
  resource: PermissionKey,
  action: PermissionAction
): Promise<void> {
  if (user.role === ROLES.ADMIN) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: permissions, error } = await supabase
    .from("user_permissions")
    .select("*")
    .eq("user_id", user.userId)
    .eq("resource", resource)
    .maybeSingle();

  if (error) {
    throw new ForbiddenError(`Error checking permissions: ${error.message}`);
  }

  if (!permissions) {
    throw new ForbiddenError(`Access denied. No permissions found for resource: ${resource}`);
  }

  if (action === 'view' && !permissions.can_view) {
    throw new ForbiddenError(`Access denied. View permission required for resource: ${resource}`);
  }

  if (action === 'edit' && !permissions.can_edit) {
    throw new ForbiddenError(`Access denied. Edit permission required for resource: ${resource}`);
  }
}

export function authorizeDelete(user: JWTPayload): void {
  if (user.role !== ROLES.ADMIN) {
    throw new ForbiddenError("Access denied. Only administrators can delete resources.");
  }
}

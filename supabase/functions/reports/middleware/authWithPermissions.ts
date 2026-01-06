import { UnauthorizedError } from "./types.ts";
import { Role, ALL_ROLES } from "./constants/roles.ts";
import { getServiceRoleClient } from "./utils/supabase.ts";

export interface AuthContext {
  userId: string;
  organizationId: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: Role[];
  isAdmin: boolean;
  permissions: string[];
}

export async function authenticateWithPermissions(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = getServiceRoleClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("organization_id, full_name, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new UnauthorizedError("User profile not found");
  }

  if (!profile.is_active) {
    throw new UnauthorizedError("User account is inactive");
  }

  if (!profile.organization_id) {
    throw new UnauthorizedError("User is not assigned to an organization");
  }

  const { data: userRoles, error: rolesError } = await supabase
    .rpc("get_user_roles", { p_user_id: user.id });

  if (rolesError || !userRoles || userRoles.length === 0) {
    throw new UnauthorizedError("User has no active roles assigned");
  }

  const roles: Role[] = userRoles
    .map((r: any) => r.role.key as Role)
    .filter((role: Role) => ALL_ROLES.includes(role));

  if (roles.length === 0) {
    throw new UnauthorizedError("User has no valid roles");
  }

  const isAdmin = roles.includes('admin');

  let permissions: string[] = [];

  const { data: permissionsList, error: permissionsError } = await supabase
    .rpc("get_user_all_permissions", { p_user_id: user.id });

  if (!permissionsError && permissionsList) {
    permissions = permissionsList.map((p: any) => p.permission_key);
  }

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    email: user.email || '',
    fullName: profile.full_name,
    isActive: profile.is_active,
    roles,
    isAdmin,
    permissions,
  };
}
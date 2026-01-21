import { AuthenticationError } from "./errorHandler.ts";
import { Role, ALL_ROLES } from "../constants/roles.ts";
import { getServiceRoleClient } from "../utils/supabase.ts";
import { authCache, type AuthContextData } from "../utils/authCache.ts";

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
    throw new AuthenticationError("Missing or invalid authorization header");
  }

  const token = authHeader.replace("Bearer ", "");

  const cached = authCache.get(token);
  if (cached) {
    return transformAuthContext(cached);
  }

  const supabase = getServiceRoleClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new AuthenticationError("Invalid or expired token");
  }

  const { data: contextData, error: contextError } = await supabase
    .rpc("get_user_auth_context", { p_user_id: user.id });

  if (contextError || !contextData) {
    throw new AuthenticationError("Unable to load user context");
  }

  if (!contextData.is_active) {
    throw new AuthenticationError("User account is inactive");
  }

  if (!contextData.organization_id) {
    throw new AuthenticationError("User is not assigned to an organization");
  }

  if (!contextData.roles || contextData.roles.length === 0) {
    throw new AuthenticationError("User has no active roles assigned");
  }

  authCache.set(token, contextData);

  return transformAuthContext(contextData);
}

function transformAuthContext(data: AuthContextData): AuthContext {
  const roles: Role[] = data.roles
    .filter((role: string) => ALL_ROLES.includes(role as Role)) as Role[];

  if (roles.length === 0) {
    throw new AuthenticationError("User has no valid roles");
  }

  const isAdmin = roles.includes('admin');

  return {
    userId: data.user_id,
    organizationId: data.organization_id,
    email: data.email,
    fullName: data.full_name,
    isActive: data.is_active,
    roles,
    isAdmin,
    permissions: data.permissions || [],
  };
}

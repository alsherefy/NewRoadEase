import { createClient } from "npm:@supabase/supabase-js@2";
import { JWTPayload, UnauthorizedError } from "../_shared/types.ts";
import { Role, ALL_ROLES } from "../_shared/constants/roles.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export async function authenticateRequest(req: Request): Promise<JWTPayload> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
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

  const { data: userRoles } = await supabase
    .from("user_roles")
    .select(`
      role_id,
      roles!inner(key, is_active)
    `)
    .eq("user_id", user.id)
    .eq("roles.is_active", true)
    .limit(1)
    .maybeSingle();

  if (!userRoles || !userRoles.roles) {
    throw new UnauthorizedError("User has no active roles assigned");
  }

  const userRole = userRoles.roles.key as Role;
  if (!ALL_ROLES.includes(userRole)) {
    throw new UnauthorizedError(`Invalid user role: ${userRoles.roles.key}`);
  }

  let permissions;
  if (userRole !== 'admin') {
    const { data: userPermissionsList } = await supabase
      .rpc("get_user_all_permissions", { p_user_id: user.id });

    permissions = userPermissionsList?.map(p => ({
      resource: p.permission_key,
      can_view: true,
      can_edit: true
    })) || [];
  }

  return {
    userId: user.id,
    role: userRole,
    organizationId: profile.organization_id,
    email: user.email || '',
    fullName: profile.full_name,
    permissions,
  };
}
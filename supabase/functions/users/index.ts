import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { adminOnly } from "../_shared/middleware/authorize.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { validateUUID, validateEmail } from "../_shared/utils/validation.ts";
import { RESOURCES } from "../_shared/constants/resources.ts";
import { ApiError } from "../_shared/types.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const supabase = getAuthenticatedClient(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const lastPart = pathParts[pathParts.length - 1];
    const action = lastPart === 'permissions' ? 'permissions' : lastPart === 'create' ? 'create' : undefined;

    let userId: string | undefined;
    if (action === 'permissions') {
      userId = pathParts[pathParts.length - 2];
    } else if (lastPart !== 'users' && action !== 'create') {
      userId = lastPart;
    }

    switch (req.method) {
      case "GET": {
        if (userId && action === "permissions") {
          const { data, error } = await supabase
            .rpc('get_user_all_permissions', { p_user_id: userId });

          if (error) throw new ApiError(error.message, "DB_ERROR", 500);
          return successResponse(data || []);
        }

        if (userId && action === "profile") {
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DB_ERROR", 500);
          return successResponse(data);
        }

        if (userId) {
          const { data, error } = await supabase
            .from("users")
            .select(`
              *,
              user_roles(
                id,
                role_id,
                created_at,
                role:roles(*)
              )
            `)
            .eq("id", userId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DB_ERROR", 500);
          if (!data) throw new ApiError("User not found", "NOT_FOUND", 404);
          return successResponse(data);
        }

        const { data, error } = await supabase
          .from("users")
          .select(`
            *,
            user_roles(
              id,
              role_id,
              created_at,
              role:roles(*)
            )
          `)
          .order("created_at", { ascending: false });

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        if (action === "create") {
          const body = await req.json();
          const { email, password, name, role_key } = body;

          const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const { data: currentUser, error: currentUserError } = await supabase
            .from("users")
            .select("organization_id")
            .eq("id", (await supabase.auth.getUser()).data.user?.id)
            .maybeSingle();

          if (currentUserError || !currentUser?.organization_id) {
            throw new ApiError("Unable to determine organization", "ORG_ERROR", 500);
          }

          const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });

          if (authError) throw new ApiError(authError.message, "AUTH_ERROR", 500);

          const { data: userData, error: userError } = await adminClient
            .from("users")
            .insert({
              id: authData.user.id,
              email,
              full_name: name,
              organization_id: currentUser.organization_id,
            })
            .select()
            .single();

          if (userError) throw new ApiError(userError.message, "DB_ERROR", 500);

          const roleKeyToUse = role_key || "receptionist";
          const { data: roleData, error: roleError } = await adminClient
            .from("roles")
            .select("id")
            .eq("organization_id", currentUser.organization_id)
            .eq("key", roleKeyToUse)
            .eq("is_system_role", true)
            .maybeSingle();

          if (roleError || !roleData) {
            throw new ApiError("Role not found", "ROLE_NOT_FOUND", 404);
          }

          const { error: userRoleError } = await adminClient
            .from("user_roles")
            .insert({
              user_id: userData.id,
              role_id: roleData.id,
            });

          if (userRoleError) throw new ApiError(userRoleError.message, "DB_ERROR", 500);

          return successResponse(userData, 201);
        }

        throw new ApiError("Invalid action", "INVALID_ACTION", 400);
      }

      case "PUT": {
        if (!userId) throw new ApiError("User ID required", "INVALID_REQUEST", 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from("users")
          .update(body)
          .eq("id", userId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        return successResponse(data);
      }

      case "DELETE": {
        if (!userId) throw new ApiError("User ID required", "INVALID_REQUEST", 400);

        const { error } = await supabase.from("users").delete().eq("id", userId);

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        return successResponse({ success: true });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
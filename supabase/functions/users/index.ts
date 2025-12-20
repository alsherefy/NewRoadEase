import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
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
    const action = lastPart === 'permissions' ? 'permissions' : undefined;

    let userId: string | undefined;
    if (action === 'permissions') {
      userId = pathParts[pathParts.length - 2];
    } else if (lastPart !== 'users') {
      userId = lastPart;
    }

    switch (req.method) {
      case "GET": {
        if (userId && action === "permissions") {
          const { data, error } = await supabase
            .from("user_permissions")
            .select("*")
            .eq("user_id", userId);

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
            .select(`*, permissions:user_permissions(*)`)
            .eq("id", userId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DB_ERROR", 500);
          if (!data) throw new ApiError("User not found", "NOT_FOUND", 404);
          return successResponse(data);
        }

        const { data, error } = await supabase
          .from("users")
          .select(`*, permissions:user_permissions(*)`)
          .order("created_at", { ascending: false });

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        if (action === "create") {
          const body = await req.json();
          const { email, password, name, role } = body;

          const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });

          if (authError) throw new ApiError(authError.message, "AUTH_ERROR", 500);

          const { data: userData, error: userError } = await supabase
            .from("users")
            .insert({
              id: authData.user.id,
              email,
              full_name: name,
              role: role || "receptionist",
            })
            .select()
            .single();

          if (userError) throw new ApiError(userError.message, "DB_ERROR", 500);
          return successResponse(userData, 201);
        }

        throw new ApiError("Invalid action", "INVALID_ACTION", 400);
      }

      case "PUT": {
        if (!userId) throw new ApiError("User ID required", "INVALID_REQUEST", 400);

        if (action === "permissions") {
          const body = await req.json();
          const { permissions } = body;

          await supabase.from("user_permissions").delete().eq("user_id", userId);

          const permissionsToInsert = permissions
            .filter((p: any) => p.can_view || p.can_edit)
            .map((p: any) => ({ user_id: userId, ...p }));

          if (permissionsToInsert.length > 0) {
            const { error } = await supabase.from("user_permissions").insert(permissionsToInsert);
            if (error) throw new ApiError(error.message, "DB_ERROR", 500);
          }

          return successResponse({ success: true });
        }

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
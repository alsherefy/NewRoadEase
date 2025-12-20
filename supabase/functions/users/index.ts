import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabaseClient(authHeader: string | null) {
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    return createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient(req.headers.get("Authorization"));
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const userId = pathParts[2];
    const action = pathParts[3];

    switch (req.method) {
      case "GET": {
        if (userId && action === "permissions") {
          const { data, error } = await supabase
            .from("user_permissions")
            .select("*")
            .eq("user_id", userId);

          if (error) return errorResponse(error.message, 500);
          return jsonResponse(data || []);
        }

        if (userId && action === "profile") {
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          if (error) return errorResponse(error.message, 500);
          return jsonResponse(data);
        }

        if (userId) {
          const { data, error } = await supabase
            .from("users")
            .select(`*, permissions:user_permissions(*)`)
            .eq("id", userId)
            .maybeSingle();

          if (error) return errorResponse(error.message, 500);
          if (!data) return errorResponse("User not found", 404);
          return jsonResponse(data);
        }

        const { data, error } = await supabase
          .from("users")
          .select(`*, permissions:user_permissions(*)`)
          .order("created_at", { ascending: false });

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data || []);
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

          if (authError) return errorResponse(authError.message, 500);

          const { data: userData, error: userError } = await supabase
            .from("users")
            .insert({
              id: authData.user.id,
              email,
              name,
              role: role || "user",
            })
            .select()
            .single();

          if (userError) return errorResponse(userError.message, 500);
          return jsonResponse(userData, 201);
        }

        return errorResponse("Invalid action", 400);
      }

      case "PUT": {
        if (!userId) return errorResponse("User ID required", 400);

        if (action === "permissions") {
          const body = await req.json();
          const { permissions } = body;

          await supabase.from("user_permissions").delete().eq("user_id", userId);

          const permissionsToInsert = permissions
            .filter((p: any) => p.can_view || p.can_edit)
            .map((p: any) => ({ user_id: userId, ...p }));

          if (permissionsToInsert.length > 0) {
            const { error } = await supabase.from("user_permissions").insert(permissionsToInsert);
            if (error) return errorResponse(error.message, 500);
          }

          return jsonResponse({ success: true });
        }

        const body = await req.json();
        const { data, error } = await supabase
          .from("users")
          .update(body)
          .eq("id", userId)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data);
      }

      case "DELETE": {
        if (!userId) return errorResponse("User ID required", 400);

        const { error } = await supabase.from("users").delete().eq("id", userId);

        if (error) return errorResponse(error.message, 500);
        return jsonResponse({ success: true });
      }

      default:
        return errorResponse("Method not allowed", 405);
    }
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500);
  }
});
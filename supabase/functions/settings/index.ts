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
    const settingsId = pathParts[2];

    switch (req.method) {
      case "GET": {
        const { data, error } = await supabase
          .from("workshop_settings")
          .select("*")
          .maybeSingle();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data);
      }

      case "POST": {
        const body = await req.json();
        const { data, error } = await supabase
          .from("workshop_settings")
          .insert(body)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data, 201);
      }

      case "PUT": {
        if (!settingsId) return errorResponse("Settings ID required", 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from("workshop_settings")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", settingsId)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data);
      }

      default:
        return errorResponse("Method not allowed", 405);
    }
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500);
  }
});
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
    const customerId = pathParts[2];

    switch (req.method) {
      case "GET": {
        if (customerId) {
          const { data, error } = await supabase
            .from("customers")
            .select("*")
            .eq("id", customerId)
            .maybeSingle();

          if (error) return errorResponse(error.message, 500);
          if (!data) return errorResponse("Customer not found", 404);
          return jsonResponse(data);
        }

        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const orderBy = url.searchParams.get("orderBy") || "created_at";
        const orderDir = url.searchParams.get("orderDir") || "desc";

        const { data, error, count } = await supabase
          .from("customers")
          .select("*", { count: "exact" })
          .order(orderBy, { ascending: orderDir === "asc" })
          .range(offset, offset + limit - 1);

        if (error) return errorResponse(error.message, 500);

        return jsonResponse({
          data: data || [],
          count: count || 0,
          hasMore: offset + limit < (count || 0),
        });
      }

      case "POST": {
        const body = await req.json();
        const { data, error } = await supabase
          .from("customers")
          .insert(body)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data, 201);
      }

      case "PUT": {
        if (!customerId) return errorResponse("Customer ID required", 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from("customers")
          .update(body)
          .eq("id", customerId)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data);
      }

      case "DELETE": {
        if (!customerId) return errorResponse("Customer ID required", 400);

        const { error } = await supabase
          .from("customers")
          .delete()
          .eq("id", customerId);

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
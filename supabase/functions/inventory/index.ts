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
    const sparePartId = pathParts[2];

    switch (req.method) {
      case "GET": {
        if (sparePartId) {
          const { data, error } = await supabase
            .from("spare_parts")
            .select("*")
            .eq("id", sparePartId)
            .maybeSingle();

          if (error) return errorResponse(error.message, 500);
          if (!data) return errorResponse("Spare part not found", 404);
          return jsonResponse(data);
        }

        const lowStockOnly = url.searchParams.get("lowStockOnly") === "true";
        const orderBy = url.searchParams.get("orderBy") || "name";
        const orderDir = url.searchParams.get("orderDir") || "asc";

        let query = supabase.from("spare_parts").select("*");

        if (lowStockOnly) {
          const { data: allParts } = await query.order(orderBy, { ascending: orderDir === "asc" });
          const lowStock = (allParts || []).filter(p => p.quantity <= p.minimum_quantity);
          return jsonResponse(lowStock);
        }

        const { data, error } = await query.order(orderBy, { ascending: orderDir === "asc" });

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data || []);
      }

      case "POST": {
        const body = await req.json();
        const { data, error } = await supabase
          .from("spare_parts")
          .insert(body)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data, 201);
      }

      case "PUT": {
        if (!sparePartId) return errorResponse("Spare part ID required", 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from("spare_parts")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", sparePartId)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data);
      }

      case "DELETE": {
        if (!sparePartId) return errorResponse("Spare part ID required", 400);

        const { error } = await supabase
          .from("spare_parts")
          .delete()
          .eq("id", sparePartId);

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
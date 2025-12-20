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
    const salaryId = pathParts[2];
    const technicianId = url.searchParams.get("technicianId");

    switch (req.method) {
      case "GET": {
        if (salaryId) {
          const { data, error } = await supabase
            .from("salaries")
            .select(`*, technician:technicians(*)`)
            .eq("id", salaryId)
            .maybeSingle();

          if (error) return errorResponse(error.message, 500);
          if (!data) return errorResponse("Salary not found", 404);
          return jsonResponse(data);
        }

        let query = supabase.from("salaries").select(`*, technician:technicians(*)`);

        if (technicianId) {
          query = query.eq("technician_id", technicianId);
        }

        const orderBy = url.searchParams.get("orderBy") || "created_at";
        const orderDir = url.searchParams.get("orderDir") || "desc";

        const { data, error } = await query.order(orderBy, { ascending: orderDir === "asc" });

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data || []);
      }

      case "POST": {
        const body = await req.json();
        const { data: salaryNumber } = await supabase.rpc("generate_salary_number");

        const { data, error } = await supabase
          .from("salaries")
          .insert({ ...body, salary_number: salaryNumber })
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data, 201);
      }

      case "PUT": {
        if (!salaryId) return errorResponse("Salary ID required", 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from("salaries")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", salaryId)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data);
      }

      case "DELETE": {
        if (!salaryId) return errorResponse("Salary ID required", 400);

        const { error } = await supabase
          .from("salaries")
          .delete()
          .eq("id", salaryId);

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
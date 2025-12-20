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
    const expenseId = pathParts[2];
    const action = pathParts[3];

    switch (req.method) {
      case "GET": {
        if (expenseId && action === "installments") {
          const { data, error } = await supabase
            .from("expense_installments")
            .select("*")
            .eq("expense_id", expenseId)
            .order("installment_number");

          if (error) return errorResponse(error.message, 500);
          return jsonResponse(data || []);
        }

        if (expenseId) {
          const { data, error } = await supabase
            .from("expenses")
            .select("*")
            .eq("id", expenseId)
            .maybeSingle();

          if (error) return errorResponse(error.message, 500);
          if (!data) return errorResponse("Expense not found", 404);
          return jsonResponse(data);
        }

        const orderBy = url.searchParams.get("orderBy") || "expense_date";
        const orderDir = url.searchParams.get("orderDir") || "desc";
        const category = url.searchParams.get("category");

        let query = supabase.from("expenses").select("*");

        if (category) {
          query = query.eq("category", category);
        }

        const { data, error } = await query.order(orderBy, { ascending: orderDir === "asc" });

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data || []);
      }

      case "POST": {
        const body = await req.json();
        const { data: expenseNumber } = await supabase.rpc("generate_expense_number");

        const { data, error } = await supabase
          .from("expenses")
          .insert({ ...body, expense_number: expenseNumber })
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data, 201);
      }

      case "PUT": {
        if (!expenseId) return errorResponse("Expense ID required", 400);

        if (action === "installments") {
          const body = await req.json();
          const installmentId = pathParts[4];
          
          if (!installmentId) return errorResponse("Installment ID required", 400);

          const { error } = await supabase
            .from("expense_installments")
            .update(body)
            .eq("id", installmentId);

          if (error) return errorResponse(error.message, 500);
          return jsonResponse({ success: true });
        }

        const body = await req.json();
        const { data, error } = await supabase
          .from("expenses")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", expenseId)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data);
      }

      case "DELETE": {
        if (!expenseId) return errorResponse("Expense ID required", 400);

        const { error } = await supabase
          .from("expenses")
          .delete()
          .eq("id", expenseId);

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
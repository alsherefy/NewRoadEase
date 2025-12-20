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
    const invoiceId = pathParts[2];

    switch (req.method) {
      case "GET": {
        if (invoiceId) {
          const { data, error } = await supabase
            .from("invoices")
            .select(`
              *,
              customer:customers(id, name, phone, email, address),
              items:invoice_items(*)
            `)
            .eq("id", invoiceId)
            .maybeSingle();

          if (error) return errorResponse(error.message, 500);
          if (!data) return errorResponse("Invoice not found", 404);
          return jsonResponse(data);
        }

        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const orderBy = url.searchParams.get("orderBy") || "created_at";
        const orderDir = url.searchParams.get("orderDir") || "desc";
        const paymentStatus = url.searchParams.get("paymentStatus");

        let query = supabase
          .from("invoices")
          .select(`
            *,
            customer:customers(id, name, phone)
          `, { count: "exact" });

        if (paymentStatus) {
          query = query.eq("payment_status", paymentStatus);
        }

        const { data, error, count } = await query
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
        const { items, ...invoiceData } = body;

        const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
        
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({ ...invoiceData, invoice_number: invoiceNumber })
          .select()
          .single();

        if (invoiceError) return errorResponse(invoiceError.message, 500);

        if (items && items.length > 0) {
          const itemsToInsert = items.map((item: any) => ({
            ...item,
            invoice_id: invoice.id,
          }));

          const { error: itemsError } = await supabase
            .from("invoice_items")
            .insert(itemsToInsert);

          if (itemsError) return errorResponse(itemsError.message, 500);
        }

        return jsonResponse(invoice, 201);
      }

      case "PUT": {
        if (!invoiceId) return errorResponse("Invoice ID required", 400);

        const body = await req.json();
        const { items, ...invoiceData } = body;

        const { data, error } = await supabase
          .from("invoices")
          .update({ ...invoiceData, updated_at: new Date().toISOString() })
          .eq("id", invoiceId)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);

        if (items) {
          await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
          
          if (items.length > 0) {
            const itemsToInsert = items.map((item: any) => ({
              ...item,
              invoice_id: invoiceId,
            }));

            const { error: itemsError } = await supabase
              .from("invoice_items")
              .insert(itemsToInsert);

            if (itemsError) return errorResponse(itemsError.message, 500);
          }
        }

        return jsonResponse(data);
      }

      case "DELETE": {
        if (!invoiceId) return errorResponse("Invoice ID required", 400);

        await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
        
        const { error } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId);

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
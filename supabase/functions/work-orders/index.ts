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
    const workOrderId = pathParts[2];

    switch (req.method) {
      case "GET": {
        if (workOrderId) {
          const { data, error } = await supabase
            .from("work_orders")
            .select(`
              *,
              customer:customers(id, name, phone, email),
              vehicle:vehicles(id, car_make, car_model, plate_number, year, vin, color),
              services:work_order_services(
                *,
                assignments:technician_assignments(
                  *,
                  technician:technicians(id, name, specialization)
                )
              ),
              spare_parts:work_order_spare_parts(
                *,
                spare_part:spare_parts(id, name, part_number)
              )
            `)
            .eq("id", workOrderId)
            .maybeSingle();

          if (error) return errorResponse(error.message, 500);
          if (!data) return errorResponse("Work order not found", 404);
          return jsonResponse(data);
        }

        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const orderBy = url.searchParams.get("orderBy") || "created_at";
        const orderDir = url.searchParams.get("orderDir") || "desc";
        const status = url.searchParams.get("status");

        let query = supabase
          .from("work_orders")
          .select(`
            *,
            customer:customers(id, name, phone),
            vehicle:vehicles(id, car_make, car_model, plate_number)
          `, { count: "exact" });

        if (status) {
          query = query.eq("status", status);
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
        const { services, spare_parts, ...workOrderData } = body;

        const { data: orderNumber } = await supabase.rpc("generate_work_order_number");
        
        const { data: workOrder, error: workOrderError } = await supabase
          .from("work_orders")
          .insert({ ...workOrderData, order_number: orderNumber })
          .select()
          .single();

        if (workOrderError) return errorResponse(workOrderError.message, 500);

        if (services && services.length > 0) {
          for (const service of services) {
            const { technicians, ...serviceData } = service;
            const { data: insertedService, error: serviceError } = await supabase
              .from("work_order_services")
              .insert({ ...serviceData, work_order_id: workOrder.id })
              .select()
              .single();

            if (serviceError) return errorResponse(serviceError.message, 500);

            if (technicians && technicians.length > 0) {
              const assignments = technicians.map((t: any) => ({
                service_id: insertedService.id,
                technician_id: t.technician_id,
                share_percentage: t.share_percentage,
                share_amount: (serviceData.price * t.share_percentage) / 100,
              }));

              const { error: assignError } = await supabase
                .from("technician_assignments")
                .insert(assignments);

              if (assignError) return errorResponse(assignError.message, 500);
            }
          }
        }

        if (spare_parts && spare_parts.length > 0) {
          const partsToInsert = spare_parts.map((sp: any) => ({
            work_order_id: workOrder.id,
            spare_part_id: sp.spare_part_id,
            quantity: sp.quantity,
            unit_price: sp.unit_price,
          }));

          const { error: partsError } = await supabase
            .from("work_order_spare_parts")
            .insert(partsToInsert);

          if (partsError) return errorResponse(partsError.message, 500);

          for (const sp of spare_parts) {
            await supabase.rpc("decrease_spare_part_quantity", {
              p_spare_part_id: sp.spare_part_id,
              p_quantity: sp.quantity,
            });
          }
        }

        return jsonResponse(workOrder, 201);
      }

      case "PUT": {
        if (!workOrderId) return errorResponse("Work order ID required", 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from("work_orders")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", workOrderId)
          .select()
          .single();

        if (error) return errorResponse(error.message, 500);
        return jsonResponse(data);
      }

      case "DELETE": {
        if (!workOrderId) return errorResponse("Work order ID required", 400);

        await supabase.from("technician_assignments").delete().in(
          "service_id",
          supabase.from("work_order_services").select("id").eq("work_order_id", workOrderId)
        );
        await supabase.from("work_order_services").delete().eq("work_order_id", workOrderId);
        await supabase.from("work_order_spare_parts").delete().eq("work_order_id", workOrderId);
        
        const { error } = await supabase
          .from("work_orders")
          .delete()
          .eq("id", workOrderId);

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
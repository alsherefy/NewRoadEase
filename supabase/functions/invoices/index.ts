import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const supabase = getAuthenticatedClient(req);
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
              work_order:work_orders(
                id,
                customer:customers(id, name, phone, email, address)
              ),
              invoice_items(*)
            `)
            .eq("id", invoiceId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DB_ERROR", 500);
          if (!data) throw new ApiError("Invoice not found", "NOT_FOUND", 404);

          const result = {
            ...data,
            customer: data.work_order?.customer || null,
            items: data.invoice_items
          };
          delete result.work_order;
          delete result.invoice_items;

          return successResponse(result);
        }

        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const orderBy = url.searchParams.get("orderBy") || "created_at";
        const orderDir = url.searchParams.get("orderDir") || "desc";
        const paymentStatus = url.searchParams.get("paymentStatus");

        let query = supabase
          .from("invoices")
          .select(`
            id,
            invoice_number,
            work_order_id,
            subtotal,
            discount_percentage,
            discount_amount,
            tax_rate,
            tax_amount,
            total,
            paid_amount,
            payment_status,
            payment_method,
            card_type,
            created_at,
            work_order:work_orders!inner(
              id,
              order_number,
              customer:customers!inner(id, name, phone)
            )
          `, { count: "exact" });

        if (paymentStatus) {
          query = query.eq("payment_status", paymentStatus);
        }

        const { data, error, count } = await query
          .order(orderBy, { ascending: orderDir === "asc" })
          .range(offset, offset + limit - 1);

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);

        const results = (data || []).map(item => ({
          ...item,
          customer: item.work_order?.customer || null
        }));

        results.forEach(item => delete item.work_order);

        return successResponse({
          data: results,
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

        if (invoiceError) throw new ApiError(invoiceError.message, "DB_ERROR", 500);

        if (items && items.length > 0) {
          const itemsToInsert = items.map((item: any) => ({
            ...item,
            invoice_id: invoice.id,
          }));

          const { error: itemsError } = await supabase
            .from("invoice_items")
            .insert(itemsToInsert);

          if (itemsError) throw new ApiError(itemsError.message, "DB_ERROR", 500);
        }

        return successResponse(invoice, 201);
      }

      case "PUT": {
        if (!invoiceId) throw new ApiError("Invoice ID required", "INVALID_REQUEST", 400);

        const body = await req.json();
        const { items, ...invoiceData } = body;

        const { data, error } = await supabase
          .from("invoices")
          .update({ ...invoiceData, updated_at: new Date().toISOString() })
          .eq("id", invoiceId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);

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

            if (itemsError) throw new ApiError(itemsError.message, "DB_ERROR", 500);
          }
        }

        return successResponse(data);
      }

      case "DELETE": {
        if (!invoiceId) throw new ApiError("Invoice ID required", "INVALID_REQUEST", 400);

        await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

        const { error } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId);

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
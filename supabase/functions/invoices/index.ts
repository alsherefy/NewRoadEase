import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateWithPermissions } from "../_shared/middleware/authWithPermissions.ts";
import { requirePermission, hasPermission } from "../_shared/middleware/permissionChecker.ts";
import { ApiError } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function corsResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

function successResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify({ success: true, data, error: null }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: any): Response {
  const errorStatus = error.status || 500;
  const errorCode = error.code || "ERROR";
  const errorMessage = error.message || "An unexpected error occurred";

  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: { code: errorCode, message: errorMessage, details: error.details || null },
    }),
    {
      status: errorStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function validateUUID(id: string | undefined, fieldName: string = "ID"): string {
  if (!id || id.trim() === "") {
    throw new ApiError(`${fieldName} is required`, "VALIDATION_ERROR", 400);
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ApiError(`Invalid ${fieldName}`, "VALIDATION_ERROR", 400);
  }
  return id;
}

function validatePagination(params: any): { limit: number; offset: number } {
  const limit = Math.min(Math.max(1, parseInt(params.limit || "50")), 100);
  const offset = Math.max(0, parseInt(params.offset || "0"));
  return { limit, offset };
}

async function validateRequestBody<T>(req: Request, requiredFields?: string[]): Promise<T> {
  const body = await req.json();
  if (requiredFields) {
    const errors: string[] = [];
    for (const field of requiredFields) {
      if (!body[field]) errors.push(`${field} is required`);
    }
    if (errors.length > 0) {
      throw new ApiError("Validation failed", "VALIDATION_ERROR", 400, { errors });
    }
  }
  return body as T;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const auth = await authenticateWithPermissions(req);
    const supabase = getAuthenticatedClient(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const lastPart = pathParts[pathParts.length - 1];
    const action = lastPart === 'generate-number' ? 'generate-number' : undefined;
    const invoiceId = lastPart !== 'invoices' && action !== 'generate-number' ? lastPart : undefined;

    switch (req.method) {
      case "GET": {
        requirePermission(auth, 'invoices.view');

        if (action === 'generate-number') {
          const { data: invoiceNumber, error } = await supabase.rpc("generate_invoice_number");
          if (error) throw new ApiError(error.message, "DB_ERROR", 500);
          return successResponse(invoiceNumber);
        }

        if (invoiceId) {
          validateUUID(invoiceId, "Invoice ID");

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
            .eq("organization_id", auth.organizationId)
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

        const pagination = validatePagination({
          limit: url.searchParams.get("limit"),
          offset: url.searchParams.get("offset"),
        });
        const limit = pagination.limit;
        const offset = pagination.offset;
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
          `, { count: "exact" })
          .eq("organization_id", auth.organizationId);

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
        requirePermission(auth, 'invoices.create');

        const body = await validateRequestBody(req, ["work_order_id", "subtotal", "total"]);
        const { items, ...invoiceData } = body;

        const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");

        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            ...invoiceData,
            invoice_number: invoiceNumber,
            organization_id: auth.organizationId,
          })
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
        validateUUID(invoiceId, "Invoice ID");

        const body = await req.json();
        const { items, ...invoiceData } = body;

        // Check if only updating payment info
        const paymentFields = ['paid_amount', 'payment_status', 'payment_method', 'card_type'];
        const isPaymentOnlyUpdate = Object.keys(invoiceData).every(key =>
          paymentFields.includes(key) || key === 'updated_at'
        );

        // Require appropriate permission based on what's being updated
        if (isPaymentOnlyUpdate) {
          // Payment updates require any of: invoices.update OR invoices.manage_payments
          if (!hasPermission(auth, 'invoices.update')) {
            requirePermission(auth, 'invoices.manage_payments');
          }
        } else {
          // Full invoice updates require invoices.update
          requirePermission(auth, 'invoices.update');
        }

        const { data, error } = await supabase
          .from("invoices")
          .update({ ...invoiceData, updated_at: new Date().toISOString() })
          .eq("id", invoiceId)
          .eq("organization_id", auth.organizationId)
          .select()
          .maybeSingle();

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        if (!data) throw new ApiError("Invoice not found or you don't have permission", "NOT_FOUND", 404);

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
        requirePermission(auth, 'invoices.delete');
        validateUUID(invoiceId, "Invoice ID");

        // First, get the invoice to find the work_order_id
        const { data: invoice, error: fetchError } = await supabase
          .from("invoices")
          .select("work_order_id")
          .eq("id", invoiceId)
          .eq("organization_id", auth.organizationId)
          .maybeSingle();

        if (fetchError) throw new ApiError(fetchError.message, "DB_ERROR", 500);
        if (!invoice) throw new ApiError("Invoice not found", "NOT_FOUND", 404);

        // Delete invoice items
        await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

        // Delete the invoice
        const { error } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId)
          .eq("organization_id", auth.organizationId);

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);

        // Reset work order status to 'in_progress' if it was linked to this invoice
        if (invoice.work_order_id) {
          await supabase
            .from("work_orders")
            .update({
              status: "in_progress",
              updated_at: new Date().toISOString()
            })
            .eq("id", invoice.work_order_id)
            .eq("organization_id", auth.organizationId);
          // Ignore errors - invoice is already deleted
        }

        return successResponse({ deleted: true, workOrderReset: !!invoice.work_order_id });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { allRoles, adminAndCustomerService, adminOnly, checkOwnership, canManagePayments } from "../_shared/middleware/authorize.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { validateUUID, validatePagination, validateRequestBody } from "../_shared/utils/validation.ts";
import { RESOURCES } from "../_shared/constants/resources.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const auth = await authenticateRequest(req);
    const supabase = getAuthenticatedClient(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const lastPart = pathParts[pathParts.length - 1];
    const invoiceId = lastPart !== 'invoices' ? lastPart : undefined;

    switch (req.method) {
      case "GET": {
        allRoles(auth);

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
        adminAndCustomerService(auth);

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

        await checkOwnership(auth, RESOURCES.INVOICES, invoiceId!);

        const body = await req.json();
        const { items, ...invoiceData } = body;

        // Check if only updating payment info (allowed for receptionist)
        const paymentFields = ['paid_amount', 'payment_status', 'payment_method', 'card_type'];
        const isPaymentOnlyUpdate = Object.keys(invoiceData).every(key =>
          paymentFields.includes(key) || key === 'updated_at'
        );

        if (isPaymentOnlyUpdate) {
          canManagePayments(auth);
        } else {
          adminAndCustomerService(auth);
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
        adminOnly(auth);
        validateUUID(invoiceId, "Invoice ID");

        await checkOwnership(auth, RESOURCES.INVOICES, invoiceId!);

        await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

        const { error } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId)
          .eq("organization_id", auth.organizationId);

        if (error) throw new ApiError(error.message, "DB_ERROR", 500);
        return successResponse({ deleted: true });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
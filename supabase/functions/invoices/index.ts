import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ApiError } from "../_shared/types.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function authenticateRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError("Missing or invalid authorization header", "UNAUTHORIZED", 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new ApiError("Invalid or expired token", "UNAUTHORIZED", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("organization_id, full_name, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new ApiError("User profile not found", "UNAUTHORIZED", 401);
  }

  if (!profile.is_active) {
    throw new ApiError("User account is inactive", "UNAUTHORIZED", 401);
  }

  if (!profile.organization_id) {
    throw new ApiError("User is not assigned to an organization", "UNAUTHORIZED", 401);
  }

  const { data: userRoles } = await supabase
    .rpc("get_user_roles", { p_user_id: user.id });

  if (!userRoles || userRoles.length === 0) {
    throw new ApiError("User has no active roles assigned", "UNAUTHORIZED", 401);
  }

  const userRole = userRoles[0].role.key;

  return {
    userId: user.id,
    role: userRole,
    organizationId: profile.organization_id,
    email: user.email || '',
    fullName: profile.full_name,
  };
}

function getAuthenticatedClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") || Deno.env.get("SUPABASE_ANON_KEY")!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function allRoles(auth: any): void {
  return;
}

function adminAndCustomerService(auth: any): void {
  if (auth.role !== 'admin' && auth.role !== 'customer_service') {
    throw new ApiError("Access denied", "FORBIDDEN", 403);
  }
}

function adminOnly(auth: any): void {
  if (auth.role !== 'admin') {
    throw new ApiError("Access denied - Admin only", "FORBIDDEN", 403);
  }
}

function canManagePayments(auth: any): void {
  if (auth.role !== 'admin' && auth.role !== 'customer_service' && auth.role !== 'receptionist') {
    throw new ApiError("Access denied", "FORBIDDEN", 403);
  }
}

async function checkOwnership(auth: any, resource: string, resourceId: string): Promise<void> {
  return;
}

const RESOURCES = {
  INVOICES: 'invoices',
};

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
          const { error: updateError } = await supabase
            .from("work_orders")
            .update({
              status: "in_progress",
              updated_at: new Date().toISOString()
            })
            .eq("id", invoice.work_order_id)
            .eq("organization_id", auth.organizationId);

          if (updateError) {
            console.error("Error resetting work order status:", updateError);
            // Don't throw error here - invoice is already deleted
          }
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
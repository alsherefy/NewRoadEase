import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedClient } from "../_shared/utils/supabase.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { adminOnly, allRoles, checkOwnership } from "../_shared/middleware/authorize.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { validateUUID, validateRequestBody } from "../_shared/utils/validation.ts";
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
    const action = lastPart === 'installments' ? 'installments' : undefined;

    let expenseId: string | undefined;
    if (action === 'installments') {
      expenseId = pathParts[pathParts.length - 2];
    } else if (lastPart !== 'expenses') {
      expenseId = lastPart;
    }

    switch (req.method) {
      case "GET": {
        allRoles(auth);

        if (expenseId && action === "installments") {
          validateUUID(expenseId, "Expense ID");

          const { data, error } = await supabase
            .from("expense_installments")
            .select("*")
            .eq("expense_id", expenseId)
            .order("installment_number");

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          return successResponse(data || []);
        }

        if (expenseId) {
          validateUUID(expenseId, "Expense ID");

          const { data, error } = await supabase
            .from("expenses")
            .select("*")
            .eq("id", expenseId)
            .eq("organization_id", auth.organizationId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          if (!data) throw new ApiError("Expense not found", "NOT_FOUND", 404);
          return successResponse(data);
        }

        const orderBy = url.searchParams.get("orderBy") || "expense_date";
        const orderDir = url.searchParams.get("orderDir") || "desc";
        const category = url.searchParams.get("category");

        let query = supabase.from("expenses").select("*").eq("organization_id", auth.organizationId);

        if (category) {
          query = query.eq("category", category);
        }

        const { data, error } = await query.order(orderBy, { ascending: orderDir === "asc" });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        adminOnly(auth);

        const body = await validateRequestBody(req, ["amount", "category", "expense_date"]);
        const { data: expenseNumber } = await supabase.rpc("generate_expense_number");

        const { data, error } = await supabase
          .from("expenses")
          .insert({
            ...body,
            expense_number: expenseNumber,
            organization_id: auth.organizationId,
          })
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data, 201);
      }

      case "PUT": {
        adminOnly(auth);
        validateUUID(expenseId, "Expense ID");

        if (action === "installments") {
          const body = await req.json();
          const installmentId = pathParts[4];

          validateUUID(installmentId, "Installment ID");

          const { error } = await supabase
            .from("expense_installments")
            .update(body)
            .eq("id", installmentId);

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          return successResponse({ success: true });
        }

        await checkOwnership(auth, RESOURCES.EXPENSES, expenseId!);

        const body = await req.json();
        const { data, error } = await supabase
          .from("expenses")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", expenseId)
          .eq("organization_id", auth.organizationId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "DELETE": {
        adminOnly(auth);
        validateUUID(expenseId, "Expense ID");

        await checkOwnership(auth, RESOURCES.EXPENSES, expenseId!);

        const { error } = await supabase
          .from("expenses")
          .delete()
          .eq("id", expenseId)
          .eq("organization_id", auth.organizationId);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({ deleted: true });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    console.error("Error in expenses endpoint:", err);
    return errorResponse(err as Error);
  }
});
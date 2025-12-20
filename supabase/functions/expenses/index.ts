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

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          return successResponse(data || []);
        }

        if (expenseId) {
          const { data, error } = await supabase
            .from("expenses")
            .select("*")
            .eq("id", expenseId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          if (!data) throw new ApiError("Expense not found", "NOT_FOUND", 404);
          return successResponse(data);
        }

        const orderBy = url.searchParams.get("orderBy") || "expense_date";
        const orderDir = url.searchParams.get("orderDir") || "desc";
        const category = url.searchParams.get("category");

        let query = supabase.from("expenses").select("*");

        if (category) {
          query = query.eq("category", category);
        }

        const { data, error } = await query.order(orderBy, { ascending: orderDir === "asc" });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      case "POST": {
        const body = await req.json();
        const { data: expenseNumber } = await supabase.rpc("generate_expense_number");

        const { data, error } = await supabase
          .from("expenses")
          .insert({ ...body, expense_number: expenseNumber })
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data, 201);
      }

      case "PUT": {
        if (!expenseId) throw new ApiError("Expense ID required", "VALIDATION_ERROR", 400);

        if (action === "installments") {
          const body = await req.json();
          const installmentId = pathParts[4];

          if (!installmentId) throw new ApiError("Installment ID required", "VALIDATION_ERROR", 400);

          const { error } = await supabase
            .from("expense_installments")
            .update(body)
            .eq("id", installmentId);

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          return successResponse({ success: true });
        }

        const body = await req.json();
        const { data, error } = await supabase
          .from("expenses")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", expenseId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "DELETE": {
        if (!expenseId) throw new ApiError("Expense ID required", "VALIDATION_ERROR", 400);

        const { error } = await supabase
          .from("expenses")
          .delete()
          .eq("id", expenseId);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({ success: true });
      }

      default:
        throw new ApiError("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  } catch (err) {
    console.error("Error in expenses endpoint:", err);
    return errorResponse(err as Error);
  }
});
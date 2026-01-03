import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedClient } from '../_shared/utils/supabase.ts';
import { authenticateWithPermissions } from '../_shared/middleware/authWithPermissions.ts';
import { requirePermission } from '../_shared/middleware/permissionChecker.ts';
import { ApiError } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: any } | null;
}

function successResponse<T>(data: T, status = 200): Response {
  const response: ApiResponse<T> = { success: true, data, error: null };
  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400, code = 'ERROR'): Response {
  const response: ApiResponse = { success: false, data: null, error: { code, message } };
  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const auth = await authenticateWithPermissions(req);
    const supabase = getAuthenticatedClient(req);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    const action = lastPart === 'installments' ? 'installments' : undefined;

    let expenseId: string | undefined;
    if (action === 'installments') {
      expenseId = pathParts[pathParts.length - 2];
    } else if (lastPart !== 'expenses') {
      expenseId = lastPart;
    }

    switch (req.method) {
      case 'GET': {
        requirePermission(auth, 'expenses.view');

        if (expenseId && action === 'installments') {
          const { data, error } = await supabase
            .from('expense_installments')
            .select('*')
            .eq('expense_id', expenseId)
            .order('installment_number');

          if (error) throw new Error(error.message);
          return successResponse(data || []);
        }

        if (expenseId) {
          const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('id', expenseId)
            .eq('organization_id', auth.organizationId)
            .maybeSingle();

          if (error) throw new Error(error.message);
          if (!data) throw new Error('Expense not found');
          return successResponse(data);
        }

        const category = url.searchParams.get('category');
        let query = supabase
          .from('expenses')
          .select('*')
          .eq('organization_id', auth.organizationId);

        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query.order('expense_date', { ascending: false });

        if (error) throw new Error(error.message);
        return successResponse(data || []);
      }

      case 'POST': {
        requirePermission(auth, 'expenses.create');

        const body = await req.json();
        const { data: expenseNumber } = await supabase.rpc('generate_expense_number');

        const { data, error } = await supabase
          .from('expenses')
          .insert({
            ...body,
            expense_number: expenseNumber,
            organization_id: auth.organizationId,
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data, 201);
      }

      case 'PUT': {
        requirePermission(auth, 'expenses.update');
        if (!expenseId) throw new Error('Expense ID required');

        const body = await req.json();
        const { organization_id, ...updateData } = body;

        const { data, error } = await supabase
          .from('expenses')
          .update(updateData)
          .eq('id', expenseId)
          .eq('organization_id', auth.organizationId)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data);
      }

      case 'DELETE': {
        requirePermission(auth, 'expenses.delete');
        if (!expenseId) throw new Error('Expense ID required');

        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId)
          .eq('organization_id', auth.organizationId);

        if (error) throw new Error(error.message);
        return successResponse({ deleted: true });
      }

      default:
        throw new Error('Method not allowed');
    }
  } catch (err) {
    const error = err as ApiError | Error;

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status, error.code);
    }

    return errorResponse(error.message, 500, 'ERROR');
  }
});
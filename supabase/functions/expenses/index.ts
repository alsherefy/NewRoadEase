import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedClient } from '../_shared/utils/supabase.ts';
import { authenticateWithPermissions } from '../_shared/middleware/authWithPermissions.ts';
import { requirePermission } from '../_shared/middleware/permissionChecker.ts';
import { corsResponse, successResponse, errorResponse } from '../_shared/utils/response.ts';
import { handleError } from '../_shared/middleware/errorHandler.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
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
            .order('installment_number')
            .limit(100);

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
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);

        let query = supabase
          .from('expenses')
          .select('*')
          .eq('organization_id', auth.organizationId);

        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query
          .order('expense_date', { ascending: false })
          .limit(limit);

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
  } catch (error) {
    return handleError(error);
  }
});
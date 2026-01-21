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
    const customerId = pathParts[pathParts.length - 1] !== 'customers' ? pathParts[pathParts.length - 1] : undefined;

    switch (req.method) {
      case 'GET': {
        requirePermission(auth, 'customers.view');

        if (customerId) {
          const { data, error } = await supabase
            .from('customers')
            .select('id, name, phone, email, created_at')
            .eq('id', customerId)
            .eq('organization_id', auth.organizationId)
            .maybeSingle();

          if (error) throw new Error(error.message);
          if (!data) throw new Error('Customer not found');
          return successResponse(data);
        }

        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 1000);
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const { data, error, count } = await supabase
          .from('customers')
          .select('id, name, phone, email, created_at', { count: 'exact' })
          .eq('organization_id', auth.organizationId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw new Error(error.message);

        return successResponse({
          data: data || [],
          total: count || 0,
          hasMore: offset + limit < (count || 0),
        });
      }

      case 'POST': {
        requirePermission(auth, 'customers.create');

        const body = await req.json();
        const { data, error } = await supabase
          .from('customers')
          .insert({ ...body, organization_id: auth.organizationId })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data, 201);
      }

      case 'PUT': {
        requirePermission(auth, 'customers.update');
        if (!customerId) throw new Error('Customer ID required');

        const body = await req.json();
        const { organization_id, ...updateData } = body;

        const { data, error } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', customerId)
          .eq('organization_id', auth.organizationId)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data);
      }

      case 'DELETE': {
        requirePermission(auth, 'customers.delete');
        if (!customerId) throw new Error('Customer ID required');

        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', customerId)
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
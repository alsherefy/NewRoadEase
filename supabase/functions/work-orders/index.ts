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
    const workOrderId = pathParts[pathParts.length - 1] !== 'work-orders' ? pathParts[pathParts.length - 1] : undefined;

    switch (req.method) {
      case 'GET': {
        requirePermission(auth, 'work_orders.view');

        if (workOrderId) {
          const { data, error } = await supabase
            .from('work_orders')
            .select(`
              id,
              order_number,
              status,
              total_labor_cost,
              total_parts_cost,
              customer_id,
              vehicle_id,
              organization_id,
              created_at,
              updated_at,
              completed_at,
              customer:customers(id, name, phone, email),
              vehicle:vehicles(id, car_make, car_model, car_year, plate_number)
            `)
            .eq('id', workOrderId)
            .eq('organization_id', auth.organizationId)
            .maybeSingle();

          if (error) throw new Error(error.message);
          if (!data) throw new Error('Work order not found');
          return successResponse(data);
        }

        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const orderBy = url.searchParams.get('orderBy') || 'created_at';
        const orderDir = url.searchParams.get('orderDir') || 'desc';
        const status = url.searchParams.get('status');

        let query = supabase
          .from('work_orders')
          .select(`
            id,
            order_number,
            status,
            total_labor_cost,
            created_at,
            customer:customers(id, name, phone),
            vehicle:vehicles(id, car_make, car_model, plate_number)
          `, { count: 'exact' })
          .eq('organization_id', auth.organizationId);

        if (status) {
          query = query.eq('status', status);
        }

        const { data, error, count } = await query
          .order(orderBy, { ascending: orderDir === 'asc' })
          .range(offset, offset + limit - 1);

        if (error) throw new Error(error.message);

        return successResponse({
          data: data || [],
          total: count || 0,
          hasMore: (count || 0) > offset + limit
        });
      }

      case 'POST': {
        requirePermission(auth, 'work_orders.create');

        const body = await req.json();
        const { data, error } = await supabase
          .from('work_orders')
          .insert({ ...body, organization_id: auth.organizationId })
          .select(`
            *,
            customer:customers(*),
            vehicle:vehicles(*)
          `)
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data, 201);
      }

      case 'PUT': {
        requirePermission(auth, 'work_orders.update');
        if (!workOrderId) throw new Error('Work order ID required');

        const body = await req.json();
        const { organization_id, ...updateData } = body;

        const { data, error } = await supabase
          .from('work_orders')
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq('id', workOrderId)
          .eq('organization_id', auth.organizationId)
          .select(`
            *,
            customer:customers(*),
            vehicle:vehicles(*)
          `)
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data);
      }

      case 'DELETE': {
        requirePermission(auth, 'work_orders.delete');
        if (!workOrderId) throw new Error('Work order ID required');

        const { error } = await supabase
          .from('work_orders')
          .delete()
          .eq('id', workOrderId)
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
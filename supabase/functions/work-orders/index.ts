import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
              *,
              customer:customers(*),
              vehicle:vehicles(*)
            `)
            .eq('id', workOrderId)
            .eq('organization_id', auth.organizationId)
            .maybeSingle();

          if (error) throw new Error(error.message);
          if (!data) throw new Error('Work order not found');
          return successResponse(data);
        }

        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const orderBy = url.searchParams.get('orderBy') || 'created_at';
        const orderDir = url.searchParams.get('orderDir') || 'desc';

        const { data, error, count } = await supabase
          .from('work_orders')
          .select(`
            *,
            customer:customers(id, name, phone),
            vehicle:vehicles(id, car_make, car_model, car_year, plate_number)
          `, { count: 'exact' })
          .eq('organization_id', auth.organizationId)
          .order(orderBy, { ascending: orderDir === 'asc' })
          .range(offset, offset + limit - 1);

        if (error) throw new Error(error.message);

        return successResponse({
          data: data || [],
          count: count || 0,
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
  } catch (err) {
    const error = err as ApiError | Error;

    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status, error.code);
    }

    return errorResponse(error.message, 500, 'ERROR');
  }
});
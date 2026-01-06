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
    const technicianId = pathParts[pathParts.length - 1] !== 'technicians' ? pathParts[pathParts.length - 1] : undefined;

    switch (req.method) {
      case 'GET': {
        requirePermission(auth, 'technicians.view');

        if (technicianId) {
          const { data, error } = await supabase
            .from('technicians')
            .select('*')
            .eq('id', technicianId)
            .eq('organization_id', auth.organizationId)
            .maybeSingle();

          if (error) throw new Error(error.message);
          if (!data) throw new Error('Technician not found');
          return successResponse(data);
        }

        const activeOnly = url.searchParams.get('activeOnly') === 'true';
        const limit = url.searchParams.get('limit');

        let query = supabase
          .from('technicians')
          .select('*')
          .eq('organization_id', auth.organizationId);

        if (activeOnly) {
          query = query.eq('is_active', true);
        }

        query = query.order('created_at', { ascending: false });

        if (limit) {
          const limitNum = Math.min(parseInt(limit), 1000);
          query = query.limit(limitNum);
        } else {
          query = query.limit(1000);
        }

        const { data, error } = await query;

        if (error) throw new Error(error.message);
        return successResponse(data || []);
      }

      case 'POST': {
        requirePermission(auth, 'technicians.create');

        const body = await req.json();
        const { data, error } = await supabase
          .from('technicians')
          .insert({ ...body, organization_id: auth.organizationId })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data, 201);
      }

      case 'PUT': {
        requirePermission(auth, 'technicians.update');
        if (!technicianId) throw new Error('Technician ID required');

        const body = await req.json();
        const { organization_id, ...updateData } = body;

        const { data, error } = await supabase
          .from('technicians')
          .update(updateData)
          .eq('id', technicianId)
          .eq('organization_id', auth.organizationId)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data);
      }

      case 'DELETE': {
        requirePermission(auth, 'technicians.delete');
        if (!technicianId) throw new Error('Technician ID required');

        const { error } = await supabase
          .from('technicians')
          .delete()
          .eq('id', technicianId)
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
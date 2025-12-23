import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

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

async function authenticateUser(req: Request, supabaseServiceKey: string, supabaseUrl: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) throw new Error('Invalid or expired token');

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) throw new Error('User profile not found or inactive');

  const { data: userRoles } = await supabase
    .rpc('get_user_roles', { p_user_id: user.id });

  if (!userRoles || userRoles.length === 0) throw new Error('User has no active roles');

  const role = userRoles[0].role.key;
  const isAdmin = role === 'admin';
  const canEdit = isAdmin || role === 'customer_service' || role === 'receptionist';

  return { userId: user.id, organizationId: profile.organization_id, isAdmin, canEdit, role };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth = await authenticateUser(req, supabaseServiceKey, supabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const workOrderId = pathParts[pathParts.length - 1] !== 'work-orders' ? pathParts[pathParts.length - 1] : undefined;

    switch (req.method) {
      case 'GET': {
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

        const { data, error } = await supabase
          .from('work_orders')
          .select(`
            *,
            customer:customers(id, name, phone),
            vehicle:vehicles(id, car_make, car_model, car_year, plate_number)
          `)
          .eq('organization_id', auth.organizationId)
          .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return successResponse(data || []);
      }

      case 'POST': {
        if (!auth.canEdit) throw new Error('Access denied');

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
        if (!auth.canEdit) throw new Error('Access denied');
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
        if (!auth.isAdmin) throw new Error('Admin access required');
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
    console.error('Error in work-orders endpoint:', err);
    const error = err as Error;
    return errorResponse(error.message, 500, 'ERROR');
  }
});
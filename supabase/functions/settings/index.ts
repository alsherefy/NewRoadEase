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

  const isAdmin = userRoles[0].role.key === 'admin';

  return { userId: user.id, organizationId: profile.organization_id, isAdmin };
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
    const settingsId = pathParts[pathParts.length - 1] !== 'settings' ? pathParts[pathParts.length - 1] : undefined;

    switch (req.method) {
      case 'GET': {
        const { data, error } = await supabase
          .from('workshop_settings')
          .select('*')
          .eq('organization_id', auth.organizationId)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return successResponse(data);
      }

      case 'POST': {
        if (!auth.isAdmin) throw new Error('Admin access required');

        const body = await req.json();
        const { data, error } = await supabase
          .from('workshop_settings')
          .insert({ ...body, organization_id: auth.organizationId })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data, 201);
      }

      case 'PUT': {
        if (!auth.isAdmin) throw new Error('Admin access required');
        if (!settingsId) throw new Error('Settings ID required');

        const body = await req.json();
        const { data, error } = await supabase
          .from('workshop_settings')
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq('id', settingsId)
          .eq('organization_id', auth.organizationId)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data);
      }

      default:
        throw new Error('Method not allowed');
    }
  } catch (err) {
    console.error('Error in settings endpoint:', err);
    const error = err as Error;
    return errorResponse(error.message, 500, 'ERROR');
  }
});
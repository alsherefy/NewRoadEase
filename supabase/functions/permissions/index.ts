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

    if (!auth.isAdmin) {
      throw new Error('Admin access required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET') {
      if (pathParts.length === 1) {
        const category = url.searchParams.get('category');

        let query = supabase
          .from('permissions')
          .select('*')
          .eq('is_active', true)
          .order('category', { ascending: true })
          .order('display_order', { ascending: true });

        if (category) {
          query = query.eq('category', category);
        }

        const { data: permissions, error } = await query;

        if (error) throw new Error(error.message);
        return successResponse(permissions || []);
      }

      if (pathParts[1] === 'check') {
        const userId = url.searchParams.get('user_id');
        const permissionKey = url.searchParams.get('permission');

        if (!userId || !permissionKey) {
          throw new Error('user_id and permission are required');
        }

        const { data, error } = await supabase.rpc('check_user_permission', {
          p_user_id: userId,
          p_permission_key: permissionKey,
        });

        if (error) throw new Error(error.message);
        return successResponse({ has_permission: data });
      }
    }

    if (req.method === 'POST') {
      if (pathParts[1] === 'check-any') {
        const body = await req.json();
        const { user_id, permissions } = body;

        if (!user_id || !permissions || !Array.isArray(permissions)) {
          throw new Error('user_id and permissions array are required');
        }

        for (const perm of permissions) {
          const { data, error } = await supabase.rpc('check_user_permission', {
            p_user_id: user_id,
            p_permission_key: perm,
          });

          if (!error && data) {
            return successResponse({ has_any_permission: true });
          }
        }

        return successResponse({ has_any_permission: false });
      }

      if (pathParts[1] === 'overrides') {
        const body = await req.json();
        const { user_id, permission_id, is_granted, reason, expires_at } = body;

        if (!user_id || !permission_id || is_granted === undefined) {
          throw new Error('user_id, permission_id, and is_granted are required');
        }

        const { data: override, error } = await supabase
          .from('user_permission_overrides')
          .insert({
            user_id,
            permission_id,
            is_granted,
            reason,
            expires_at,
            granted_by: auth.userId,
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(override);
      }
    }

    if (req.method === 'DELETE') {
      if (pathParts[1] === 'overrides') {
        const overrideId = pathParts[2];

        const { error } = await supabase
          .from('user_permission_overrides')
          .delete()
          .eq('id', overrideId);

        if (error) throw new Error(error.message);
        return successResponse({ message: 'Permission override deleted successfully' });
      }
    }

    throw new Error('Method not allowed');
  } catch (err) {
    console.error('Error in permissions endpoint:', err);
    const error = err as Error;
    return errorResponse(error.message, 500, 'ERROR');
  }
});
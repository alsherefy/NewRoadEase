import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: any;
  } | null;
}

function successResponse<T>(data: T): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    error: null,
  };
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400, code = 'ERROR', details?: any): Response {
  const response: ApiResponse = {
    success: false,
    data: null,
    error: { code, message, details },
  };
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return errorResponse('User not found', 404, 'USER_NOT_FOUND');
    }

    if (userData.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403, 'FORBIDDEN');
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const method = req.method;

    if (method === 'GET') {
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

        if (error) throw error;
        return successResponse(permissions || []);
      }

      if (pathParts[1] === 'check') {
        const userId = url.searchParams.get('user_id');
        const permissionKey = url.searchParams.get('permission');

        if (!userId || !permissionKey) {
          return errorResponse('user_id and permission are required', 400, 'MISSING_PARAMS');
        }

        const { data, error } = await supabase.rpc('check_user_permission', {
          p_user_id: userId,
          p_permission_key: permissionKey,
        });

        if (error) throw error;
        return successResponse({ has_permission: data });
      }
    }

    if (method === 'POST') {
      if (pathParts[1] === 'check-any') {
        const body = await req.json();
        const { user_id, permissions } = body;

        if (!user_id || !permissions || !Array.isArray(permissions)) {
          return errorResponse('user_id and permissions array are required', 400, 'MISSING_FIELDS');
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
          return errorResponse('user_id, permission_id, and is_granted are required', 400, 'MISSING_FIELDS');
        }

        const { data: override, error } = await supabase
          .from('user_permission_overrides')
          .insert({
            user_id,
            permission_id,
            is_granted,
            reason,
            expires_at,
            granted_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return successResponse(override);
      }
    }

    if (method === 'DELETE') {
      if (pathParts[1] === 'overrides') {
        const overrideId = pathParts[2];

        const { error } = await supabase
          .from('user_permission_overrides')
          .delete()
          .eq('id', overrideId);

        if (error) throw error;
        return successResponse({ message: 'Permission override deleted successfully' });
      }
    }

    return errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
});
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
    const lastPart = pathParts[pathParts.length - 1];
    const action = lastPart === 'permissions' ? 'permissions' : lastPart === 'create' ? 'create' : undefined;

    let userId: string | undefined;
    if (action === 'permissions') {
      userId = pathParts[pathParts.length - 2];
    } else if (lastPart !== 'users' && action !== 'create') {
      userId = lastPart;
    }

    switch (req.method) {
      case 'GET': {
        if (userId && action === 'permissions') {
          const { data, error } = await supabase
            .rpc('get_user_all_permissions', { p_user_id: userId });

          if (error) throw new Error(error.message);
          return successResponse(data || []);
        }

        if (userId) {
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (error) throw new Error(error.message);
          if (!userData) throw new Error('User not found');

          const { data: userRoles } = await supabase
            .rpc('get_user_roles', { p_user_id: userId });

          return successResponse({ ...userData, user_roles: userRoles || [] });
        }

        const { data: usersData, error } = await supabase
          .from('users')
          .select('*')
          .eq('organization_id', auth.organizationId)
          .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        const usersWithRoles = await Promise.all(
          (usersData || []).map(async (user) => {
            const { data: userRoles } = await supabase
              .rpc('get_user_roles', { p_user_id: user.id });
            return { ...user, user_roles: userRoles || [] };
          })
        );

        return successResponse(usersWithRoles);
      }

      case 'POST': {
        if (!auth.isAdmin) throw new Error('Admin access required');
        if (action !== 'create') throw new Error('Invalid action');

        const body = await req.json();
        const { email, password, name, role_key } = body;

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError) throw new Error(authError.message);

        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            full_name: name,
            organization_id: auth.organizationId,
          })
          .select()
          .single();

        if (userError) throw new Error(userError.message);

        const roleKeyToUse = role_key || 'receptionist';
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('organization_id', auth.organizationId)
          .eq('key', roleKeyToUse)
          .eq('is_system_role', true)
          .maybeSingle();

        if (roleError || !roleData) {
          throw new Error('Role not found');
        }

        const { error: userRoleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userData.id,
            role_id: roleData.id,
          });

        if (userRoleError) throw new Error(userRoleError.message);

        return successResponse(userData, 201);
      }

      case 'PUT': {
        if (!auth.isAdmin) throw new Error('Admin access required');
        if (!userId) throw new Error('User ID required');

        const body = await req.json();
        const { data, error } = await supabase
          .from('users')
          .update(body)
          .eq('id', userId)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return successResponse(data);
      }

      case 'DELETE': {
        if (!auth.isAdmin) throw new Error('Admin access required');
        if (!userId) throw new Error('User ID required');

        const { error } = await supabase.from('users').delete().eq('id', userId);

        if (error) throw new Error(error.message);
        return successResponse({ success: true });
      }

      default:
        throw new Error('Method not allowed');
    }
  } catch (err) {
    console.error('Error in users endpoint:', err);
    const error = err as Error;
    return errorResponse(error.message, 500, 'ERROR');
  }
});
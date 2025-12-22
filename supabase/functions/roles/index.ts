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
        const { data: roles, error } = await supabase
          .from('roles')
          .select('*')
          .eq('organization_id', auth.organizationId)
          .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return successResponse(roles || []);
      }

      const roleId = pathParts[1];

      if (pathParts[2] === 'permissions') {
        const { data: rolePermissions, error } = await supabase
          .from('role_permissions')
          .select(`
            permission_id,
            permissions (
              id,
              key,
              resource,
              action,
              category,
              display_order,
              is_active
            )
          `)
          .eq('role_id', roleId);

        if (error) throw new Error(error.message);

        const permissions = rolePermissions?.map(rp => (rp as any).permissions).filter(Boolean) || [];
        return successResponse(permissions);
      }

      if (pathParts[2] === 'users') {
        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select(`
            user_id,
            users (
              id,
              email,
              full_name,
              is_active
            )
          `)
          .eq('role_id', roleId);

        if (error) throw new Error(error.message);

        const users = userRoles?.map(ur => (ur as any).users).filter(Boolean) || [];
        return successResponse(users);
      }

      const { data: role, error } = await supabase
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .eq('organization_id', auth.organizationId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!role) throw new Error('Role not found');
      return successResponse(role);
    }

    if (req.method === 'POST') {
      const body = await req.json();

      if (pathParts[2] === 'permissions' && pathParts[1]) {
        const roleId = pathParts[1];
        const { permission_ids } = body;

        const { error: deleteError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId);

        if (deleteError) throw new Error(deleteError.message);

        if (permission_ids && permission_ids.length > 0) {
          const rolePermissions = permission_ids.map((permissionId: string) => ({
            role_id: roleId,
            permission_id: permissionId,
          }));

          const { error: insertError } = await supabase
            .from('role_permissions')
            .insert(rolePermissions);

          if (insertError) throw new Error(insertError.message);
        }

        return successResponse({ success: true });
      }

      const { data: newRole, error } = await supabase
        .from('roles')
        .insert({ ...body, organization_id: auth.organizationId })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return successResponse(newRole, 201);
    }

    if (req.method === 'PUT') {
      const roleId = pathParts[1];
      if (!roleId) throw new Error('Role ID required');

      const body = await req.json();
      const { organization_id, ...updateData } = body;

      const { data: updatedRole, error } = await supabase
        .from('roles')
        .update(updateData)
        .eq('id', roleId)
        .eq('organization_id', auth.organizationId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return successResponse(updatedRole);
    }

    if (req.method === 'DELETE') {
      const roleId = pathParts[1];
      if (!roleId) throw new Error('Role ID required');

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)
        .eq('organization_id', auth.organizationId)
        .eq('is_system_role', false);

      if (error) throw new Error(error.message);
      return successResponse({ success: true });
    }

    throw new Error('Method not allowed');
  } catch (err) {
    console.error('Error in roles endpoint:', err);
    const error = err as Error;
    return errorResponse(error.message, 500, 'ERROR');
  }
});
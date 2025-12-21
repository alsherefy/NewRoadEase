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
        const { data: roles, error } = await supabase
          .from('roles')
          .select('*')
          .eq('organization_id', userData.organization_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
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

        if (error) throw error;

        const permissions = rolePermissions?.map(rp => (rp as any).permissions).filter(Boolean) || [];
        return successResponse(permissions);
      }

      if (pathParts[2] === 'users') {
        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role_id', roleId);

        if (error) throw error;

        const userIds = userRoles?.map(ur => ur.user_id) || [];
        return successResponse(userIds);
      }

      const { data: role, error } = await supabase
        .from('roles')
        .select(`
          *,
          role_permissions (
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
          )
        `)
        .eq('id', roleId)
        .eq('organization_id', userData.organization_id)
        .single();

      if (error) throw error;
      return successResponse(role);
    }

    if (method === 'POST') {
      if (pathParts[1] === 'assign') {
        const body = await req.json();
        const { user_id, role_id } = body;

        if (!user_id || !role_id) {
          return errorResponse('user_id and role_id are required', 400, 'MISSING_FIELDS');
        }

        const { data: userRole, error } = await supabase
          .from('user_roles')
          .insert({
            user_id,
            role_id,
            assigned_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return successResponse(userRole);
      }

      const body = await req.json();
      const { key, permission_ids } = body;

      if (!key) {
        return errorResponse('Role key is required', 400, 'MISSING_FIELDS');
      }

      const { data: newRole, error: roleError } = await supabase
        .from('roles')
        .insert({
          key,
          organization_id: userData.organization_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (roleError) throw roleError;

      if (permission_ids && permission_ids.length > 0) {
        const rolePermissions = permission_ids.map((permId: string) => ({
          role_id: newRole.id,
          permission_id: permId,
          granted_by: user.id,
        }));

        const { error: permError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions);

        if (permError) throw permError;
      }

      return successResponse(newRole);
    }

    if (method === 'PUT') {
      const roleId = pathParts[1];

      if (pathParts[2] === 'permissions') {
        const body = await req.json();
        const { permission_ids } = body;

        await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId);

        if (permission_ids && permission_ids.length > 0) {
          const rolePermissions = permission_ids.map((permId: string) => ({
            role_id: roleId,
            permission_id: permId,
            granted_by: user.id,
          }));

          const { error } = await supabase
            .from('role_permissions')
            .insert(rolePermissions);

          if (error) throw error;
        }

        return successResponse({ message: 'Permissions updated successfully' });
      }

      const body = await req.json();

      const { data: updatedRole, error } = await supabase
        .from('roles')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId)
        .eq('organization_id', userData.organization_id)
        .select()
        .single();

      if (error) throw error;
      return successResponse(updatedRole);
    }

    if (method === 'DELETE') {
      if (pathParts[1] === 'assignments') {
        const userRoleId = pathParts[2];

        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('id', userRoleId);

        if (error) throw error;
        return successResponse({ message: 'Role assignment removed successfully' });
      }

      const roleId = pathParts[1];

      const { data: role } = await supabase
        .from('roles')
        .select('is_system_role')
        .eq('id', roleId)
        .single();

      if (role?.is_system_role) {
        return errorResponse('Cannot delete system role', 400, 'SYSTEM_ROLE');
      }

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)
        .eq('organization_id', userData.organization_id);

      if (error) throw error;
      return successResponse({ message: 'Role deleted successfully' });
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
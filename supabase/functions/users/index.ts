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
    const lastPart = pathParts[pathParts.length - 1];
    const action = lastPart === 'permissions' ? 'permissions' : lastPart === 'permission-overrides' ? 'permission-overrides' : lastPart === 'create' ? 'create' : undefined;

    let userId: string | undefined;
    if (action === 'permissions' || action === 'permission-overrides') {
      userId = pathParts[pathParts.length - 2];
    } else if (lastPart !== 'users' && action !== 'create') {
      userId = lastPart;
    }

    switch (req.method) {
      case 'GET': {
        requirePermission(auth, 'users.view');

        if (userId && action === 'permissions') {
          const { data, error } = await supabase
            .rpc('get_user_all_permissions', { p_user_id: userId });

          if (error) throw new Error(error.message);
          return successResponse(data || []);
        }

        if (userId && action === 'permission-overrides') {
          const { data: allPerms, error: permsError } = await supabase
            .rpc('get_user_all_permissions', { p_user_id: userId });

          if (permsError) throw new Error(permsError.message);

          const { data: permissionsData, error: permError } = await supabase
            .from('permissions')
            .select('id, key')
            .eq('is_active', true);

          if (permError) throw new Error(permError.message);

          const userPermissionKeys = new Set((allPerms || []).map((p: any) => p.permission_key));
          const selectedPermissions = (permissionsData || [])
            .filter((p: any) => userPermissionKeys.has(p.key))
            .map((p: any) => ({ permission_id: p.id, is_granted: true }));

          return successResponse(selectedPermissions);
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
        requirePermission(auth, 'users.create');
        if (action !== 'create') throw new Error('Invalid action');

        const body = await req.json();
        const { email, password, name, role_key, permission_ids } = body;

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

        if (permission_ids && Array.isArray(permission_ids) && permission_ids.length > 0) {
          const permissionsToInsert = permission_ids.map((permissionId: string) => ({
            user_id: userData.id,
            permission_id: permissionId,
            is_granted: true,
            granted_by: auth.userId,
            reason: 'Initial permissions on user creation'
          }));

          const { error: permissionsError } = await supabase
            .from('user_permission_overrides')
            .insert(permissionsToInsert);

          if (permissionsError) throw new Error(permissionsError.message);
        }

        const { data: userRoles } = await supabase
          .rpc('get_user_roles', { p_user_id: userData.id });

        return successResponse({ ...userData, user_roles: userRoles || [] }, 201);
      }

      case 'PUT': {
        requirePermission(auth, 'users.update');
        if (!userId) throw new Error('User ID required');

        const body = await req.json();

        if (action === 'permissions') {
          const { permission_ids } = body;

          if (!Array.isArray(permission_ids)) {
            throw new Error('permission_ids must be an array');
          }

          const selectedPermissionIds = new Set(permission_ids);

          const { data: allPermissions, error: permError } = await supabase
            .from('permissions')
            .select('id')
            .eq('is_active', true);

          if (permError) throw new Error(permError.message);

          const { data: userRolesData } = await supabase
            .rpc('get_user_roles', { p_user_id: userId });

          let rolePermissionIds = new Set<string>();
          if (userRolesData && userRolesData.length > 0) {
            const roleIds = userRolesData.map((ur: any) => ur.role.id);
            const { data: rolePerms } = await supabase
              .from('role_permissions')
              .select('permission_id')
              .in('role_id', roleIds);

            if (rolePerms) {
              rolePermissionIds = new Set(rolePerms.map((rp: any) => rp.permission_id));
            }
          }

          const { error: deleteError } = await supabase
            .from('user_permission_overrides')
            .delete()
            .eq('user_id', userId);

          if (deleteError) throw new Error(deleteError.message);

          const overridesToInsert = [];

          for (const perm of allPermissions || []) {
            const permId = perm.id;
            const isSelected = selectedPermissionIds.has(permId);
            const isInRole = rolePermissionIds.has(permId);

            if (isSelected && !isInRole) {
              overridesToInsert.push({
                user_id: userId,
                permission_id: permId,
                is_granted: true,
                granted_by: auth.userId,
                reason: 'Explicit permission grant by administrator'
              });
            } else if (!isSelected && isInRole) {
              overridesToInsert.push({
                user_id: userId,
                permission_id: permId,
                is_granted: false,
                granted_by: auth.userId,
                reason: 'Explicit permission revoke by administrator'
              });
            }
          }

          if (overridesToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('user_permission_overrides')
              .insert(overridesToInsert);

            if (insertError) throw new Error(insertError.message);
          }

          return successResponse({
            success: true,
            message: 'Permissions updated successfully',
            count: permission_ids.length,
            overrides: overridesToInsert.length
          });
        }

        if (body.role) {
          const roleKey = body.role;
          delete body.role;

          const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('id')
            .eq('organization_id', auth.organizationId)
            .eq('key', roleKey)
            .maybeSingle();

          if (roleError || !roleData) {
            throw new Error('Role not found: ' + roleKey);
          }

          const { error: deleteRoleError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId);

          if (deleteRoleError) throw new Error(deleteRoleError.message);

          const { error: insertRoleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: userId,
              role_id: roleData.id,
            });

          if (insertRoleError) throw new Error(insertRoleError.message);
        }

        if (Object.keys(body).length > 0) {
          const { error } = await supabase
            .from('users')
            .update(body)
            .eq('id', userId);

          if (error) throw new Error(error.message);
        }

        const { data: updatedUser, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError) throw new Error(fetchError.message);

        const { data: userRoles } = await supabase
          .rpc('get_user_roles', { p_user_id: userId });

        return successResponse({ ...updatedUser, user_roles: userRoles || [] });
      }

      case 'DELETE': {
        requirePermission(auth, 'users.delete');
        if (!userId) throw new Error('User ID required');

        const { error } = await supabase.from('users').delete().eq('id', userId);

        if (error) throw new Error(error.message);
        return successResponse({ success: true });
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
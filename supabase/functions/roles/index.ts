import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticateWithPermissions } from "../_shared/middleware/authWithPermissions.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { getSupabaseClient } from "../_shared/utils/supabase.ts";
import { ApiError, ForbiddenError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const auth = await authenticateWithPermissions(req);

    if (!auth.isAdmin) {
      throw new ForbiddenError('ليس لديك صلاحية لإدارة الأدوار - Only admins can manage roles');
    }

    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET') {
      if (pathParts.length === 1) {
        const { data: roles, error } = await supabase
          .from('roles')
          .select('*')
          .eq('organization_id', auth.organizationId)
          .order('created_at', { ascending: false });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
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

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);

        const permissions = rolePermissions?.map(rp => (rp as any).permissions).filter(Boolean) || [];
        return successResponse(permissions);
      }

      if (pathParts[2] === 'users') {
        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role_id', roleId);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);

        const userIds = userRoles?.map(ur => ur.user_id) || [];

        if (userIds.length === 0) {
          return successResponse([]);
        }

        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, email, full_name, is_active')
          .in('id', userIds);

        if (usersError) throw new ApiError(usersError.message, "DATABASE_ERROR", 500);
        return successResponse(users || []);
      }

      const { data: role, error } = await supabase
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .eq('organization_id', auth.organizationId)
        .maybeSingle();

      if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
      if (!role) throw new ApiError('Role not found', 'NOT_FOUND', 404);
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

        if (deleteError) throw new ApiError(deleteError.message, "DATABASE_ERROR", 500);

        if (permission_ids && permission_ids.length > 0) {
          const rolePermissions = permission_ids.map((permissionId: string) => ({
            role_id: roleId,
            permission_id: permissionId,
          }));

          const { error: insertError } = await supabase
            .from('role_permissions')
            .insert(rolePermissions);

          if (insertError) throw new ApiError(insertError.message, "DATABASE_ERROR", 500);
        }

        return successResponse({ success: true });
      }

      const { data: newRole, error } = await supabase
        .from('roles')
        .insert({ ...body, organization_id: auth.organizationId })
        .select()
        .single();

      if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
      return successResponse(newRole, 201);
    }

    if (req.method === 'PUT') {
      const roleId = pathParts[1];
      if (!roleId) throw new ApiError('Role ID required', 'VALIDATION_ERROR', 400);

      const body = await req.json();

      if (pathParts[2] === 'permissions') {
        const { permission_ids } = body;

        const { error: deleteError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId);

        if (deleteError) throw new ApiError(deleteError.message, "DATABASE_ERROR", 500);

        if (permission_ids && permission_ids.length > 0) {
          const rolePermissions = permission_ids.map((permissionId: string) => ({
            role_id: roleId,
            permission_id: permissionId,
          }));

          const { error: insertError } = await supabase
            .from('role_permissions')
            .insert(rolePermissions);

          if (insertError) throw new ApiError(insertError.message, "DATABASE_ERROR", 500);
        }

        return successResponse({ success: true });
      }

      const { organization_id, ...updateData } = body;

      const { data: updatedRole, error } = await supabase
        .from('roles')
        .update(updateData)
        .eq('id', roleId)
        .eq('organization_id', auth.organizationId)
        .select()
        .single();

      if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
      return successResponse(updatedRole);
    }

    if (req.method === 'DELETE') {
      const roleId = pathParts[1];
      if (!roleId) throw new ApiError('Role ID required', 'VALIDATION_ERROR', 400);

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)
        .eq('organization_id', auth.organizationId)
        .eq('is_system_role', false);

      if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
      return successResponse({ success: true });
    }

    throw new ApiError('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  } catch (error) {
    return errorResponse(error);
  }
});

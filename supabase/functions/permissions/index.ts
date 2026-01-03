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
    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET') {
      if (pathParts.length === 1) {
        if (!auth.isAdmin) {
          throw new ForbiddenError('ليس لديك صلاحية لعرض جميع الصلاحيات - Only admins can view all permissions');
        }

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

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(permissions || []);
      }

      if (pathParts[1] === 'user' && pathParts[3] === 'permissions') {
        const userId = pathParts[2];

        if (!userId) {
          throw new ApiError('user_id is required', 'VALIDATION_ERROR', 400);
        }

        if (!auth.isAdmin && auth.userId !== userId) {
          throw new ForbiddenError('You can only view your own permissions');
        }

        const { data, error } = await supabase.rpc('get_user_all_permissions', {
          p_user_id: userId
        });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      if (pathParts[1] === 'user' && pathParts[3] === 'overrides') {
        const userId = pathParts[2];

        if (!userId) {
          throw new ApiError('user_id is required', 'VALIDATION_ERROR', 400);
        }

        if (!auth.isAdmin) {
          throw new ForbiddenError('Only admins can view permission overrides');
        }

        const { data, error } = await supabase
          .from('user_permission_overrides')
          .select(`
            *,
            permission:permissions(*)
          `)
          .eq('user_id', userId)
          .eq('is_granted', true)
          .order('created_at', { ascending: false });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      if (pathParts[1] === 'template') {
        if (!auth.isAdmin) {
          throw new ForbiddenError('Only admins can view role templates');
        }

        const roleKey = url.searchParams.get('role');

        if (!roleKey) {
          throw new ApiError('role parameter is required', 'VALIDATION_ERROR', 400);
        }

        const { data, error } = await supabase.rpc('get_role_permission_template', {
          p_role_key: roleKey
        });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data || []);
      }

      if (pathParts[1] === 'check') {
        const userId = url.searchParams.get('user_id');
        const permissionKey = url.searchParams.get('permission');

        if (!userId || !permissionKey) {
          throw new ApiError('user_id and permission are required', 'VALIDATION_ERROR', 400);
        }

        const { data, error } = await supabase.rpc('user_has_permission', {
          p_user_id: userId,
          p_permission_key: permissionKey,
        });

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({ has_permission: data });
      }
    }

    if (req.method === 'POST') {
      if (pathParts[1] === 'check-any') {
        const body = await req.json();
        const { user_id, permissions } = body;

        if (!user_id || !permissions || !Array.isArray(permissions)) {
          throw new ApiError('user_id and permissions array are required', 'VALIDATION_ERROR', 400);
        }

        for (const perm of permissions) {
          const { data, error } = await supabase.rpc('user_has_permission', {
            p_user_id: user_id,
            p_permission_key: perm,
          });

          if (!error && data) {
            return successResponse({ has_any_permission: true });
          }
        }

        return successResponse({ has_any_permission: false });
      }

      if (pathParts[1] === 'grant-bulk') {
        if (!auth.isAdmin) {
          throw new ForbiddenError('Only admins can grant permissions');
        }

        const body = await req.json();
        const { user_id, permission_ids, reason } = body;

        if (!user_id || !permission_ids || !Array.isArray(permission_ids)) {
          throw new ApiError('user_id and permission_ids array are required', 'VALIDATION_ERROR', 400);
        }

        const permissionsToInsert = permission_ids.map(permId => ({
          user_id,
          permission_id: permId,
          is_granted: true,
          reason: reason || 'Granted by admin',
          granted_by: auth.userId,
          created_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
          .from('user_permission_overrides')
          .upsert(permissionsToInsert, {
            onConflict: 'user_id,permission_id',
            ignoreDuplicates: false
          })
          .select();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({
          message: `${permission_ids.length} permissions granted successfully`,
          granted: data
        });
      }

      if (pathParts[1] === 'revoke-bulk') {
        if (!auth.isAdmin) {
          throw new ForbiddenError('Only admins can revoke permissions');
        }

        const body = await req.json();
        const { user_id, permission_ids } = body;

        if (!user_id || !permission_ids || !Array.isArray(permission_ids)) {
          throw new ApiError('user_id and permission_ids array are required', 'VALIDATION_ERROR', 400);
        }

        const { error } = await supabase
          .from('user_permission_overrides')
          .delete()
          .eq('user_id', user_id)
          .in('permission_id', permission_ids);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({
          message: `${permission_ids.length} permissions revoked successfully`
        });
      }

      if (pathParts[1] === 'overrides') {
        if (!auth.isAdmin) {
          throw new ForbiddenError('Only admins can manage permission overrides');
        }

        const body = await req.json();
        const { user_id, permission_id, is_granted, reason, expires_at } = body;

        if (!user_id || !permission_id || is_granted === undefined) {
          throw new ApiError('user_id, permission_id, and is_granted are required', 'VALIDATION_ERROR', 400);
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

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(override);
      }
    }

    if (req.method === 'DELETE') {
      if (!auth.isAdmin) {
        throw new ForbiddenError('Only admins can delete permission overrides');
      }

      if (pathParts[1] === 'overrides') {
        const overrideId = pathParts[2];

        const { error } = await supabase
          .from('user_permission_overrides')
          .delete()
          .eq('id', overrideId);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({ message: 'Permission override deleted successfully' });
      }
    }

    throw new ApiError('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  } catch (error) {
    return errorResponse(error);
  }
});

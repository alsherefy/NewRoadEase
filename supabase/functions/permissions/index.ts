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
      throw new ForbiddenError('ليس لديك صلاحية لإدارة الصلاحيات - Only admins can manage permissions');
    }

    const supabase = getSupabaseClient();
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

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(permissions || []);
      }

      if (pathParts[1] === 'check') {
        const userId = url.searchParams.get('user_id');
        const permissionKey = url.searchParams.get('permission');

        if (!userId || !permissionKey) {
          throw new ApiError('user_id and permission are required', 'VALIDATION_ERROR', 400);
        }

        const { data, error } = await supabase.rpc('check_user_permission', {
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

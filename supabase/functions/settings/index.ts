import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticateWithPermissions } from "../_shared/middleware/authWithPermissions.ts";
import { requirePermission } from "../_shared/middleware/permissionChecker.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { getSupabaseClient } from "../_shared/utils/supabase.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const auth = await authenticateWithPermissions(req);

    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const settingsId = pathParts[pathParts.length - 1] !== 'settings' ? pathParts[pathParts.length - 1] : undefined;

    switch (req.method) {
      case 'GET': {
        requirePermission(auth, 'settings.view');

        const { data, error } = await supabase
          .from('workshop_settings')
          .select('*')
          .eq('organization_id', auth.organizationId)
          .maybeSingle();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case 'POST': {
        requirePermission(auth, 'settings.update');

        const body = await req.json();
        const { data, error } = await supabase
          .from('workshop_settings')
          .insert({ ...body, organization_id: auth.organizationId })
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data, 201);
      }

      case 'PUT': {
        requirePermission(auth, 'settings.update');
        if (!settingsId) throw new ApiError('Settings ID required', 'VALIDATION_ERROR', 400);

        const body = await req.json();
        const { data, error } = await supabase
          .from('workshop_settings')
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq('id', settingsId)
          .eq('organization_id', auth.organizationId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      default:
        throw new ApiError('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
    }
  } catch (error) {
    return errorResponse(error);
  }
});

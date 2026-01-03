import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { authenticateWithPermissions } from "../_shared/middleware/authWithPermissions.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { ApiError, ForbiddenError } from "../_shared/types.ts";

interface ChangePasswordRequest {
  user_id: string;
  new_password: string;
  current_password?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const auth = await authenticateWithPermissions(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body: ChangePasswordRequest = await req.json();
    const { user_id, new_password, current_password } = body;

    if (!user_id || !new_password) {
      throw new ApiError("معرف المستخدم وكلمة المرور الجديدة مطلوبة - User ID and new password are required", "VALIDATION_ERROR", 400);
    }

    if (new_password.length < 6) {
      throw new ApiError("كلمة المرور يجب أن تكون 6 أحرف على الأقل - Password must be at least 6 characters", "VALIDATION_ERROR", 400);
    }

    const isOwnPassword = user_id === auth.userId;

    if (!isOwnPassword && !auth.isAdmin) {
      throw new ForbiddenError("ليس لديك صلاحية لتغيير كلمة مرور هذا المستخدم - You do not have permission to change this user's password");
    }

    if (isOwnPassword && !auth.isAdmin && current_password) {
      const { data: userEmail } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("id", user_id)
        .maybeSingle();

      if (userEmail) {
        const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email: userEmail.email,
          password: current_password,
        });

        if (signInError) {
          throw new ApiError("كلمة المرور الحالية غير صحيحة - Current password is incorrect", "INVALID_CURRENT_PASSWORD", 400);
        }
      }
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    );

    if (updateError) {
      throw new ApiError(updateError.message, "UPDATE_FAILED", 400);
    }

    return successResponse({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح - Password changed successfully",
    });
  } catch (error) {
    return errorResponse(error);
  }
});

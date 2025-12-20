import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { ApiError } from "../_shared/types.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new ApiError("غير مصرح", "UNAUTHORIZED", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      throw new ApiError("غير مصرح", "UNAUTHORIZED", 401);
    }

    const { data: requestingUserData } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", requestingUser.id)
      .single();

    const body: ChangePasswordRequest = await req.json();
    const { user_id, new_password, current_password } = body;

    if (!user_id || !new_password) {
      throw new ApiError("معرف المستخدم وكلمة المرور الجديدة مطلوبة", "VALIDATION_ERROR", 400);
    }

    if (new_password.length < 6) {
      throw new ApiError("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "VALIDATION_ERROR", 400);
    }

    const isOwnPassword = user_id === requestingUser.id;
    const isAdmin = requestingUserData?.role === "admin";

    if (!isOwnPassword && !isAdmin) {
      throw new ApiError("ليس لديك صلاحية لتغيير كلمة مرور هذا المستخدم", "FORBIDDEN", 403);
    }

    if (isOwnPassword && !isAdmin && current_password) {
      const { data: userEmail } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("id", user_id)
        .single();

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
          throw new ApiError("كلمة المرور الحالية غير صحيحة", "INVALID_CURRENT_PASSWORD", 400);
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
      message: "تم تغيير كلمة المرور بنجاح",
    });
  } catch (err) {
    console.error("Error in change-password endpoint:", err);
    return errorResponse(err as Error);
  }
});

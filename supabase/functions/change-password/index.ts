import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChangePasswordRequest {
  user_id: string;
  new_password: string;
  current_password?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: requestingUserData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', requestingUser.id)
      .single();

    const body: ChangePasswordRequest = await req.json();
    const { user_id, new_password, current_password } = body;

    if (!user_id || !new_password) {
      return new Response(
        JSON.stringify({ error: 'معرف المستخدم وكلمة المرور الجديدة مطلوبة' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const isOwnPassword = user_id === requestingUser.id;
    const isAdmin = requestingUserData?.role === 'admin';

    if (!isOwnPassword && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'ليس لديك صلاحية لتغيير كلمة مرور هذا المستخدم' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (isOwnPassword && !isAdmin && current_password) {
      const { data: userEmail } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', user_id)
        .single();

      if (userEmail) {
        const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
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
          return new Response(
            JSON.stringify({ error: 'كلمة المرور الحالية غير صحيحة' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'تم تغيير كلمة المرور بنجاح',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'حدث خطأ غير متوقع' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
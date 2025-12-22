import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function getAuthenticatedClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  return createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

export function getServiceRoleClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey);
}
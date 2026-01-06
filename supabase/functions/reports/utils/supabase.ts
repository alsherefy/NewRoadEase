import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

export function getServiceRoleClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export function getAuthenticatedClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export function getSupabaseClient() {
  return getServiceRoleClient();
}
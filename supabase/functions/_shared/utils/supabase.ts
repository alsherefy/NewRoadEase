import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

/**
 * Get Supabase client with SERVICE ROLE KEY (bypasses RLS)
 * Use ONLY for administrative operations that need to bypass RLS
 * For regular CRUD operations, use getAuthenticatedClient instead
 */
export function getServiceRoleClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get Supabase client authenticated with USER TOKEN (respects RLS)
 * This is the default client to use for all CRUD operations
 * RLS policies will be enforced based on the authenticated user
 */
export function getAuthenticatedClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  // Use ANON KEY with user token - this respects RLS policies
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

/**
 * @deprecated Use getServiceRoleClient() instead
 */
export function getSupabaseClient() {
  return getServiceRoleClient();
}
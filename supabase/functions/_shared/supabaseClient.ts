// ==============================================================================
// ClientPulse AI — Shared Supabase Client Factory
// File: supabase/functions/_shared/supabaseClient.ts
//
// WHY TWO CLIENTS?
// 1. User Client (createUserClient):
//    Uses the incoming user's JWT from the 'Authorization' header.
//    PostgreSQL enforces Row Level Security (RLS) automatically, so the user
//    can ONLY see or modify their own agency data.
//
// 2. Admin Client (createAdminClient):
//    Uses the secret SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
//    Used ONLY for system-level jobs like:
//    - Validating public client portal tokens
//    - Running scheduled background cron jobs
// ==============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Creates a standard Supabase client scoped to the caller's JWT.
 * Guarantees that PostgreSQL Row Level Security (RLS) is strictly enforced.
 */
export function createUserClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Creates an admin Supabase client with the service role key.
 * CAUTION: Bypasses Row Level Security! Never expose to client-side requests.
 */
export function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Helper to authenticate and return the current user from the incoming request.
 * Returns null if the token is missing or invalid.
 */
export async function getAuthenticatedUser(req: Request) {
  const supabase = createUserClient(req);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

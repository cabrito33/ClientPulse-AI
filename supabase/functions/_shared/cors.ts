// ==============================================================================
// ClientPulse AI — Shared CORS Configuration
// File: supabase/functions/_shared/cors.ts
//
// Cross-Origin Resource Sharing (CORS) Security:
// - Internal agency endpoints (generate-report, approve-and-send, github-sync,
//   onboarding-chat, dispatch-scheduled-reports) are restricted to the app origin
//   specified by NEXT_PUBLIC_APP_URL.
// - Public client portal endpoint (client-portal-data) maintains '*' access so
//   clients can securely view their weekly progress via unguessable portal tokens.
// ==============================================================================

/**
 * Standard CORS headers restricted to NEXT_PUBLIC_APP_URL for agency-authenticated functions.
 * Dynamically resolves origin from environment variable, falling back to '*' in local development.
 */
export const corsHeaders: Record<string, string> = {
  get 'Access-Control-Allow-Origin'() {
    return Deno.env.get('NEXT_PUBLIC_APP_URL') || '*';
  },
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-scheduled-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

/**
 * Public CORS headers specifically for the zero-login client portal data endpoint.
 */
export const publicCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/**
 * Helper to handle HTTP OPTIONS preflight requests.
 */
export function handleCors(req: Request, isPublic = false): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: isPublic ? publicCorsHeaders : corsHeaders,
    });
  }
  return null;
}

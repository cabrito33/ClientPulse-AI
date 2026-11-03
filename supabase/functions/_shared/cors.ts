// ==============================================================================
// ClientPulse AI — Shared CORS Configuration
// File: supabase/functions/_shared/cors.ts
//
// WHAT IS CORS?
// Cross-Origin Resource Sharing (CORS) is a browser security mechanism.
// When your Next.js frontend (running on localhost:3000) calls a Supabase
// Edge Function (running on localhost:54321 or supabase.co), the browser asks:
// "Is this frontend allowed to talk to this backend function?"
//
// These headers tell the browser: "Yes, allow requests from any origin with
// standard authentication headers."
// ==============================================================================

export const corsHeaders = {
  // Allow any web application origin (frontend) to call this function
  'Access-Control-Allow-Origin': '*',
  // Allowed headers in client requests (Auth Bearer token, Content-Type, Supabase API key)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // Allowed HTTP methods
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

/**
 * Helper to handle HTTP OPTIONS preflight requests.
 * Browsers automatically send an OPTIONS request before POST requests to check permissions.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

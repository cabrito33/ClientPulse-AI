// ==============================================================================
// ClientPulse AI — Edge Function: client-portal-data
// File: supabase/functions/client-portal-data/index.ts
//
// PURPOSE:
// Public, Zero-Login API endpoint for the end-client portal web page.
// The end client accesses the portal using a secure UUID link received in email:
//   https://clientpulse.app/portal/d4b29596-f947-4972-965a-0824b0b8cbf0
//
// WHAT IT RETURNS:
// 1. Client profile (name, company).
// 2. The latest weekly report (3 executive blocks).
// 3. Historical past reports archive.
// 4. Sprint velocity metrics (tasks completed per week) for simple charts.
//
// SECURITY:
// - Protected by CORS headers.
// - Zero Login: No passwords or Supabase Auth required for the end client.
// - Token-Gated: Validates the 128-bit UUID token strictly against clients.portal_token.
// - Strictly read-only: Never permits mutations from this endpoint.
// ==============================================================================

import { publicCorsHeaders, handleCors } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req, true);
  if (corsResponse) return corsResponse;

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use GET.' }), {
      status: 405,
      headers: { ...publicCorsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Extract and Validate 'token' Query Parameter
    const url = new URL(req.url);
    const token = url.searchParams.get('token')?.trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing required 'token' query parameter." }), {
        status: 400,
        headers: { ...publicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return new Response(JSON.stringify({ error: 'Invalid portal token format.' }), {
        status: 400,
        headers: { ...publicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Shared database RPC enforces active, unexpired, non-revoked portal token.
    // Never look up clients.portal_token directly with the service-role key.
    const supabase = createAdminClient();
    const { data: portal, error } = await supabase.rpc('get_portal_data_by_token', {
      p_token: token,
    });
    if (error) {
      console.error('[client-portal-data] Portal RPC failed:', error.message);
      return new Response(JSON.stringify({ error: 'Portal temporarily unavailable.' }), {
        status: 503,
        headers: { ...publicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!portal) {
      return new Response(JSON.stringify({ error: 'Portal link invalid, expired or revoked.' }), {
        status: 404,
        headers: { ...publicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const responseData = portal as {
      client?: { name?: string; company_name?: string | null; language?: string };
      reports?: Array<Record<string, unknown>>;
      metrics?: Array<Record<string, unknown>>;
    };
    const reports = responseData.reports ?? [];
    return new Response(JSON.stringify({
      client: {
        name: responseData.client?.name,
        company_name: responseData.client?.company_name,
        language: responseData.client?.language,
      },
      latest_report: reports[0] ?? null,
      history: reports.slice(1),
      metrics: {
        total_reports: reports.length,
        sprint_velocity: responseData.metrics ?? [],
      },
    }), {
      status: 200,
      headers: { ...publicCorsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...publicCorsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

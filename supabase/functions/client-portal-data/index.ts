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

    // 2. Fetch Client Record Using Admin Client (service_role)
    const supabase = createAdminClient();

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, company_name, language')
      .eq('portal_token', token)
      .maybeSingle();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Client portal not found. The link may be invalid or revoked.' }),
        { status: 404, headers: { ...publicCorsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Fetch All Sent/Approved Reports for this Client
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('id, status, period_start, period_end, summary_done, summary_blockers, summary_next_steps, sent_at, created_at')
      .eq('client_id', client.id)
      .in('status', ['sent', 'approved'])
      .order('period_end', { ascending: false });

    if (reportsError) {
      throw new Error(`Failed to load client reports: ${reportsError.message}`);
    }

    const reportList = reports ?? [];
    const latestReport = reportList.length > 0 ? reportList[0] : null;
    const history = reportList.length > 1 ? reportList.slice(1) : [];

    // 4. Fetch Sprint Velocity Metrics (Completed tasks per sprint)
    const { data: tasks, error: tasksError } = await supabase
      .from('report_tasks')
      .select('id, report_id, status_category, title')
      .eq('client_id', client.id)
      .eq('status_category', 'done');

    if (tasksError) {
      console.warn('Warning: Could not fetch sprint tasks for metrics:', tasksError.message);
    }

    // Calculate tasks completed per report period
    const taskCountByReport: Record<string, number> = {};
    for (const t of tasks ?? []) {
      taskCountByReport[t.report_id] = (taskCountByReport[t.report_id] || 0) + 1;
    }

    const sprintVelocity = reportList
      .slice()
      .reverse()
      .map((r) => ({
        report_id: r.id,
        period_end: r.period_end,
        completed_tasks: taskCountByReport[r.id] || 0,
      }));

    // 5. Return Clean JSON Response
    return new Response(
      JSON.stringify({
        client: {
          name: client.name,
          company_name: client.company_name,
          language: client.language,
        },
        latest_report: latestReport,
        history,
        metrics: {
          total_reports: reportList.length,
          sprint_velocity: sprintVelocity,
        },
      }),
      { status: 200, headers: { ...publicCorsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...publicCorsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

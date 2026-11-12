// ==============================================================================
// ClientPulse AI — Edge Function: email-tracking
// File: supabase/functions/email-tracking/index.ts
// Issue: [BE-21] [P2] [M] Webhook/tracking de abertura de e-mail (openedAt) #35
//
// PURPOSE:
// 1. Serves 1x1 tracking pixel (GET) embedded in weekly report emails.
// 2. Receives webhook events (POST) from Resend for 'email.opened'.
// 3. Records timestamp of first open into 'reports.opened_at' and 'delivery_logs.opened_at'.
// 4. Guarantees idempotency: repeated open events NEVER overwrite the first timestamp.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';

// 1x1 transparent GIF binary representation (43 bytes)
const TRANSPARENT_GIF_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);

  // --------------------------------------------------------------------------
  // 1. GET Request: 1x1 Transparent Tracking Pixel
  // --------------------------------------------------------------------------
  if (req.method === 'GET') {
    const reportId = url.searchParams.get('reportId') || url.searchParams.get('report_id') || url.searchParams.get('id');
    const token = url.searchParams.get('token');

    if (reportId || token) {
      try {
        const supabase = createAdminClient();

        let resolvedReportId = reportId;

        // If portal token provided, find latest report for this client
        if (!resolvedReportId && token) {
          const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('portal_token', token)
            .maybeSingle();

          if (client) {
            const { data: latestReport } = await supabase
              .from('reports')
              .select('id')
              .eq('client_id', client.id)
              .order('period_start', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestReport) {
              resolvedReportId = latestReport.id;
            }
          }
        }

        if (resolvedReportId) {
          // Idempotent atomic update: only updates if opened_at IS NULL
          await supabase
            .from('reports')
            .update({ opened_at: new Date().toISOString() })
            .eq('id', resolvedReportId)
            .is('opened_at', null);

          // Update delivery log if exists
          await supabase
            .from('delivery_logs')
            .update({ opened_at: new Date().toISOString() })
            .eq('report_id', resolvedReportId)
            .is('opened_at', null);
        }
      } catch (err) {
        console.error('Error tracking email open pixel:', err);
      }
    }

    return new Response(TRANSPARENT_GIF_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': String(TRANSPARENT_GIF_PIXEL.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }

  // --------------------------------------------------------------------------
  // 2. POST Request: JSON Webhook or Direct Tracking API
  // --------------------------------------------------------------------------
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      const supabase = createAdminClient();

      // Check if Resend webhook payload structure
      const isResendWebhook = body.type === 'email.opened';
      let targetReportId = body.reportId || body.report_id || body.id;
      const customTimestamp = body.timestamp || body.created_at || new Date().toISOString();

      if (isResendWebhook && body.data) {
        targetReportId =
          body.data.tags?.report_id ||
          body.data.tags?.reportId ||
          body.data.metadata?.report_id ||
          body.data.email_id;
      }

      if (!targetReportId) {
        return new Response(
          JSON.stringify({ error: "Missing required 'reportId' or valid Resend webhook payload." }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check existing state to verify if this is the first open
      const { data: existingReport, error: fetchErr } = await supabase
        .from('reports')
        .select('id, opened_at')
        .eq('id', targetReportId)
        .maybeSingle();

      if (fetchErr || !existingReport) {
        return new Response(
          JSON.stringify({ error: `Report with id '${targetReportId}' not found.` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Acceptance Criterion 3: Repeated requests NEVER overwrite the first recorded timestamp
      if (existingReport.opened_at) {
        return new Response(
          JSON.stringify({
            success: true,
            report_id: existingReport.id,
            opened_at: existingReport.opened_at,
            is_first_open: false,
            message: 'Report was already opened previously. Initial timestamp preserved.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Acceptance Criterion 1: Record timestamp of first open
      const recordedTimestamp = customTimestamp;
      const { data: updatedReport, error: updateErr } = await supabase
        .from('reports')
        .update({ opened_at: recordedTimestamp, updated_at: new Date().toISOString() })
        .eq('id', targetReportId)
        .is('opened_at', null)
        .select('id, opened_at')
        .single();

      if (updateErr) {
        throw updateErr;
      }

      return new Response(
        JSON.stringify({
          success: true,
          report_id: updatedReport.id,
          opened_at: updatedReport.opened_at,
          is_first_open: true,
          message: 'First open timestamp successfully recorded.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed. Use GET or POST.' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

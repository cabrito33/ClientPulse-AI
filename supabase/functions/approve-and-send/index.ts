// ==============================================================================
// ClientPulse AI — Edge Function: approve-and-send
// File: supabase/functions/approve-and-send/index.ts
//
// PURPOSE:
// 1. Allows an agency manager to approve a draft report from the dashboard.
// 2. Optionally accepts user edits for the 3 blocks before sending.
// 3. Updates report status from 'draft' to 'sent'.
// 4. Calls Resend to dispatch the professional email with the portal link.
// 5. Stores sent timestamp and Resend delivery ID for audit.
//
// SECURITY:
// - Protected by CORS.
// - Authenticated agency user only (Supabase JWT).
// - Validates that the report belongs to the caller's agency.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createUserClient, getAuthenticatedUser } from '../_shared/supabaseClient.ts';
import { sendReportEmail } from '../_shared/resend.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Verify User Authentication
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid Supabase Auth token.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse Payload
    const body = await req.json().catch(() => ({}));
    const { report_id, updated_blocks } = body;

    if (!report_id) {
      return new Response(JSON.stringify({ error: "Missing required 'report_id'." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createUserClient(req);

    // 3. Fetch Report & Associated Client Details
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select(`
        id,
        agency_id,
        client_id,
        status,
        period_start,
        period_end,
        summary_done,
        summary_blockers,
        summary_next_steps,
        original_summary,
        created_at,
        review_opened_at,
        clients:client_id (
          id,
          name,
          email,
          company_name,
          language,
          portal_token,
          github_project_title
        )
      `)
      .eq('id', report_id)
      .single();

    if (reportError || !report) {
      return new Response(JSON.stringify({ error: `Report '${report_id}' not found or access denied.` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safely extract client object
    const client = Array.isArray(report.clients) ? report.clients[0] : report.clients;
    if (!client || !client.email) {
      return new Response(JSON.stringify({ error: 'Associated client does not have a valid email address.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Determine final summary blocks (applying manager edits if provided)
    const summaryDone = updated_blocks?.done ?? report.summary_done;
    const summaryBlockers = updated_blocks?.blockers ?? report.summary_blockers;
    const summaryNextSteps = updated_blocks?.next_steps ?? report.summary_next_steps;

    // 4.5 Ensure portal token is active with configured expiration (BE-19)
    if (client.portal_token) {
      try {
        const expirationDays = Number(Deno.env.get('PORTAL_TOKEN_EXPIRATION_DAYS') || '90') || 90;
        const expiresAt = new Date(Date.now() + expirationDays * 86400000).toISOString();
        await supabase
          .from('portal_tokens')
          .upsert({
            client_id: client.id,
            agency_id: report.agency_id,
            token: client.portal_token,
            is_active: true,
            revoked_at: null,
            expires_at: expiresAt,
          }, { onConflict: 'token' });
      } catch (tokenErr) {
        console.warn('[approve-and-send] Failed to ensure portal token record:', tokenErr);
      }
    }

    // 5. Send Transactional Email via Resend
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';
    let emailResult: { id: string; mock: boolean };

    try {
      emailResult = await sendReportEmail({
        toEmail: client.email,
        clientName: client.name,
        companyName: client.company_name,
        projectTitle: client.github_project_title || client.company_name || client.name,
        periodStart: report.period_start,
        periodEnd: report.period_end,
        summaryDone,
        summaryBlockers,
        summaryNextSteps,
        portalToken: client.portal_token,
        reportId: report.id,
        appUrl,
        language: (client.language as 'pt' | 'en') ?? 'pt',
      });
    } catch (emailErr: unknown) {
      const emailErrMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      const now = new Date().toISOString();

      // Mark report as failed so dashboard alert and manual resend button trigger!
      await supabase
        .from('reports')
        .update({
          status: 'failed',
          summary_done: summaryDone,
          summary_blockers: summaryBlockers,
          summary_next_steps: summaryNextSteps,
          updated_at: now,
        })
        .eq('id', report.id);

      // Record audit record in delivery_logs
      await supabase.from('delivery_logs').insert({
        report_id: report.id,
        client_id: report.client_id,
        agency_id: report.agency_id,
        status: 'failed',
        email_service: 'resend',
        recipient_email: client.email,
        error_message: emailErrMsg,
        sent_at: now,
      });

      return new Response(
        JSON.stringify({
          error: `Falha no envio de e-mail (Resend): ${emailErrMsg}. O relatório foi marcado com falha para permitir reenvio.`,
          report_id: report.id,
          status: 'failed',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Helper: compute line changes between original and updated blocks
    const calculateLineDiffCount = (origText: string, updatedText: string): number => {
      const origLines = origText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const newLines = updatedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      const origCounts = new Map<string, number>();
      for (const l of origLines) {
        origCounts.set(l, (origCounts.get(l) || 0) + 1);
      }

      let matches = 0;
      for (const l of newLines) {
        const c = origCounts.get(l) || 0;
        if (c > 0) {
          matches++;
          origCounts.set(l, c - 1);
        }
      }

      const removed = origLines.length - matches;
      const added = newLines.length - matches;
      return removed + added;
    };

    const origSummary = (report.original_summary as Record<string, string> | null) ?? {};
    const origDone = origSummary.done ?? report.summary_done ?? '';
    const origBlockers = origSummary.blockers ?? report.summary_blockers ?? '';
    const origNext = origSummary.next_steps ?? report.summary_next_steps ?? '';

    const editCount =
      calculateLineDiffCount(origDone, summaryDone) +
      calculateLineDiffCount(origBlockers, summaryBlockers) +
      calculateLineDiffCount(origNext, summaryNextSteps);

    let timeToApproveSeconds: number | null = null;
    if (report.review_opened_at) {
      const reviewOpenedDate = new Date(report.review_opened_at);
      timeToApproveSeconds = Math.max(
        0,
        Math.round((now.getTime() - reviewOpenedDate.getTime()) / 1000)
      );
    }

    // 6. Update Report in Database
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        status: 'sent',
        summary_done: summaryDone,
        summary_blockers: summaryBlockers,
        summary_next_steps: summaryNextSteps,
        edit_count: editCount,
        time_to_approve_seconds: timeToApproveSeconds,
        approved_at: nowIso,
        sent_at: nowIso,
        email_delivery_id: emailResult.id,
      })
      .eq('id', report.id);

    if (updateError) {
      throw new Error(`Report sent but failed to update status: ${updateError.message}`);
    }

    // Record audit record in delivery_logs
    await supabase.from('delivery_logs').insert({
      report_id: report.id,
      client_id: report.client_id,
      agency_id: report.agency_id,
      status: 'sent',
      email_service: 'resend',
      recipient_email: client.email,
      message_id: emailResult.id,
      sent_at: nowIso,
    });

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report.id,
        status: 'sent',
        sent_at: now,
        email_delivery_id: emailResult.id,
        is_mock_delivery: emailResult.mock,
        mock: emailResult.mock,
        portal_url: `${appUrl.replace(/\/$/, '')}/portal/${client.portal_token}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

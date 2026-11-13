// ==============================================================================
// ClientPulse AI — Edge Function: generate-report
// File: supabase/functions/generate-report/index.ts
//
// PURPOSE:
// 1. Fetches client settings (tone, language, board ID, column mappings).
// 2. Extracts cards from GitHub Projects v2 updated/closed in the last 7 days.
// 3. Invokes Google Gemini API with strict anti-hallucination prompt.
// 4. Stores the structured 3-block report draft in 'reports' table.
// 5. Stores granular tasks in 'report_tasks' for portal sprint metrics.
//
// SECURITY:
// - Protected by CORS.
// - Supports both User JWT (from dashboard) and Scheduled Secret (from pg_cron).
// - Row Level Security ensures reports belong strictly to the requesting agency.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createUserClient, createAdminClient, getAuthenticatedUser } from '../_shared/supabaseClient.ts';
import { fetchBoardTasks } from '../_shared/github.ts';
import { generateExecutiveReport } from '../_shared/gemini.ts';
import { decryptPat } from '../_shared/crypto.ts';
import { sendReportEmail } from '../_shared/resend.ts';

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 2. Authenticate Caller
    // Check if called by scheduled cron secret OR by a logged-in user
    const scheduledSecret = req.headers.get('X-Scheduled-Secret');
    const expectedSecret = Deno.env.get('SCHEDULED_FUNCTION_SECRET');
    const isCron = scheduledSecret && expectedSecret && scheduledSecret === expectedSecret;

    let user = null;
    if (!isCron) {
      user = await getAuthenticatedUser(req);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid authentication token.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Parse Request Payload
    const body = await req.json().catch(() => ({}));
    const { client_id, custom_notes, period_days } = body;

    if (!client_id) {
      return new Response(JSON.stringify({ error: "Missing required 'client_id' parameter." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use admin client if cron, or user-scoped client if agency manager
    const supabase = isCron ? createAdminClient() : createUserClient(req);

    // 4. Fetch Client Settings
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, agency_id, name, email, company_name, communication_tone, language, github_project_id, column_mapping, auto_send_enabled, portal_token')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: `Client '${client_id}' not found or access denied.` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Fetch Agency GitHub PAT Token (decrypting if stored encrypted)
    const { data: integration, error: integrationError } = await supabase
      .from('github_integrations')
      .select('pat_token, pat_token_encrypted')
      .eq('agency_id', client.agency_id)
      .single();

    let patToken: string | null = null;
    if (integration?.pat_token_encrypted) {
      patToken = await decryptPat(integration.pat_token_encrypted);
    } else if (integration?.pat_token) {
      patToken = integration.pat_token;
    }

    if (integrationError || !patToken) {
      return new Response(
        JSON.stringify({
          error: "GitHub integration not configured for this agency. Please save a GitHub Personal Access Token first.",
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Fetch Raw Tasks from GitHub Projects v2 GraphQL
    const days = period_days && period_days > 0 ? Number(period_days) : 7;
    const tasks = await fetchBoardTasks(
      patToken,
      client.github_project_id,
      client.column_mapping ?? {},
      days
    );

    // 7. Invoke Gemini AI to Synthesize the 3 Blocks (with Graceful Fallback)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    let reportBlocks: { done: string; blockers: string; next_steps: string };
    let modelUsed = 'fallback';
    let generatedWithoutAi = false;
    let aiErrorMessage: string | null = null;

    try {
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not configured in Supabase environment secrets.');
      }
      const aiResult = await generateExecutiveReport(geminiApiKey, {
        clientName: client.name,
        companyName: client.company_name,
        language: (client.language as 'pt' | 'en') ?? 'pt',
        tone: (client.communication_tone as 'formal' | 'executive' | 'casual') ?? 'executive',
        tasks: {
          done: tasks.done,
          inProgress: tasks.inProgress,
          blocked: tasks.blocked,
        },
        customNotes: custom_notes,
      });
      reportBlocks = aiResult;
      modelUsed = aiResult.modelUsed;
    } catch (aiErr: unknown) {
      // Graceful fallback: Do NOT return HTTP 500. Group raw task titles into the 3 blocks.
      generatedWithoutAi = true;
      modelUsed = 'fallback';
      aiErrorMessage = aiErr instanceof Error ? aiErr.message : String(aiErr);
      console.warn(`[generate-report] Gemini synthesis unavailable, falling back to raw tasks:`, aiErrorMessage);

      const doneLines = tasks.done.length > 0
        ? tasks.done.map((t) => `• ${t.title}${t.assignee ? ` (${t.assignee})` : ''}`).join('\n')
        : '• Nenhuma tarefa concluída no período selecionado.';

      const blockerLines = tasks.blocked.length > 0
        ? tasks.blocked.map((t) => `• ${t.title}${t.assignee ? ` (${t.assignee})` : ''}`).join('\n')
        : '• Nenhum impedimento ativo esta semana. Todas as atividades seguem o planeamento previsto.';

      const nextLines = tasks.inProgress.length > 0
        ? tasks.inProgress.map((t) => `• ${t.title}${t.assignee ? ` (${t.assignee})` : ''}`).join('\n')
        : '• Planeamento e definição das próximas atividades em curso.';

      reportBlocks = {
        done: doneLines,
        blockers: blockerLines,
        next_steps: nextLines,
      };
    }

    // 8. Calculate Period Dates
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodEnd.getDate() - days);

    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    // Determine Bypass vs Manual Approval (BE-16)
    // If client has auto_send_enabled = true (or bypass: true in request body) AND synthesis succeeded with AI
    const shouldBypass = body.bypass !== undefined ? Boolean(body.bypass) : Boolean(client.auto_send_enabled);
    const isBypass = shouldBypass && !generatedWithoutAi;

    let initialStatus = isBypass ? 'sent' : 'draft';
    let emailDeliveryId: string | null = null;
    let sentAtTimestamp: string | null = null;

    if (isBypass && client.email) {
      try {
        const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';
        const emailResult = await sendReportEmail({
          toEmail: client.email,
          clientName: client.name,
          companyName: client.company_name,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          summaryDone: reportBlocks.done,
          summaryBlockers: reportBlocks.blockers,
          summaryNextSteps: reportBlocks.next_steps,
          portalToken: client.portal_token,
          appUrl,
          language: (client.language as 'pt' | 'en') ?? 'pt',
        });
        emailDeliveryId = emailResult.id;
        sentAtTimestamp = new Date().toISOString();
      } catch (emailErr: unknown) {
        console.error('[generate-report] Bypass auto-send failed:', emailErr);
        initialStatus = 'failed';
      }
    }

    // 9. Save or Update Report into Database
    const rawData = {
      tasks: tasks.all,
      tasks_completed: tasks.done.length,
      tasks_planned: tasks.all.length,
      model_used: modelUsed,
      generated_without_ai: generatedWithoutAi,
      ai_error: aiErrorMessage,
    };

    // Helper to calculate ISO week and year to prevent duplicate drafts for the same week
    const getIsoWeekYear = (d: Date): { year: number; week: number } => {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return { year: date.getUTCFullYear(), week: weekNo };
    };

    const currentIso = getIsoWeekYear(periodEnd);

    // Check if an existing draft report exists for this client in the same week
    const { data: existingDrafts } = await supabase
      .from('reports')
      .select('id, period_start, period_end, created_at')
      .eq('client_id', client.id)
      .eq('status', 'draft');

    const matchingDraft = (existingDrafts || []).find((d: { id: string; period_start: string; period_end: string; created_at: string }) => {
      const targetDate = d.period_end ? new Date(d.period_end) : new Date(d.created_at);
      const targetIso = getIsoWeekYear(targetDate);
      return targetIso.year === currentIso.year && targetIso.week === currentIso.week;
    });

    let report: { id: string };

    if (matchingDraft) {
      const { data: updatedReport, error: updateError } = await supabase
        .from('reports')
        .update({
          period_start: periodStartStr,
          period_end: periodEndStr,
          summary_done: reportBlocks.done,
          summary_blockers: reportBlocks.blockers,
          summary_next_steps: reportBlocks.next_steps,
          raw_github_data: rawData,
          status: initialStatus,
          approved_at: sentAtTimestamp,
          sent_at: sentAtTimestamp,
          email_delivery_id: emailDeliveryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchingDraft.id)
        .select()
        .single();

      if (updateError || !updatedReport) {
        throw new Error(`Failed to update existing draft report: ${updateError?.message}`);
      }
      report = updatedReport;

      // Clean up previous granular tasks before re-inserting
      await supabase.from('report_tasks').delete().eq('report_id', matchingDraft.id);
    } else {
      const { data: insertedReport, error: reportInsertError } = await supabase
        .from('reports')
        .insert({
          client_id: client.id,
          agency_id: client.agency_id,
          status: initialStatus,
          period_start: periodStartStr,
          period_end: periodEndStr,
          summary_done: reportBlocks.done,
          summary_blockers: reportBlocks.blockers,
          summary_next_steps: reportBlocks.next_steps,
          raw_github_data: rawData,
          approved_at: sentAtTimestamp,
          sent_at: sentAtTimestamp,
          email_delivery_id: emailDeliveryId,
        })
        .select()
        .single();

      if (reportInsertError || !insertedReport) {
        throw new Error(`Failed to save report in database: ${reportInsertError?.message}`);
      }
      report = insertedReport;
    }

    // 10. Save Granular Tasks in 'report_tasks' for Sprint Metrics
    if (tasks.all.length > 0) {
      const taskInserts = tasks.all.map((t) => ({
        report_id: report.id,
        client_id: client.id,
        github_item_id: t.id,
        title: t.title,
        status_category: t.statusCategory === 'other' ? 'in_progress' : t.statusCategory,
        assignee: t.assignee,
        labels: t.labels,
        closed_at: t.closedAt,
      }));

      await supabase.from('report_tasks').insert(taskInserts);
    }

    // 11. Calculate and Save/Upsert Sprint Metrics for this period
    const weekNum = currentIso.week;
    const sprintCode = `S${weekNum}`;
    const sprintLabel = `Semana ${weekNum}`;
    const completedCount = tasks.done.length;
    const plannedCount = tasks.all.length;

    // Remove any erroneous future sprint metrics for this client
    await supabase
      .from('sprint_metrics')
      .delete()
      .eq('client_id', client.id)
      .gt('sprint', sprintCode);

    await supabase.from('sprint_metrics').upsert({
      client_id: client.id,
      agency_id: client.agency_id,
      sprint: sprintCode,
      label: sprintLabel,
      completed: completedCount,
      planned: plannedCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,sprint' });

    // 12. Return Success Response
    return new Response(
      JSON.stringify({
        success: true,
        report_id: report.id,
        client_id: client.id,
        status: initialStatus,
        auto_sent: isBypass && initialStatus === 'sent',
        generated_without_ai: generatedWithoutAi,
        period: {
          start: periodStartStr,
          end: periodEndStr,
        },
        blocks: reportBlocks,
        sprint_metric: {
          sprint: sprintCode,
          label: sprintLabel,
          completed: completedCount,
          planned: plannedCount,
        },
        tasks_count: {
          total: tasks.all.length,
          done: tasks.done.length,
          in_progress: tasks.inProgress.length,
          blocked: tasks.blocked.length,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

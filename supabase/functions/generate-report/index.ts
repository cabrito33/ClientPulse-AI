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
      .select('id, agency_id, name, company_name, communication_tone, language, github_project_id, column_mapping')
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
    let generatedWithoutAi = false;
    let aiErrorMessage: string | null = null;

    try {
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not configured in Supabase environment secrets.');
      }
      reportBlocks = await generateExecutiveReport(geminiApiKey, {
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
    } catch (aiErr: unknown) {
      // Graceful fallback: Do NOT return HTTP 500. Group raw task titles into the 3 blocks.
      generatedWithoutAi = true;
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

    // 9. Save Draft Report into Database
    const rawData = {
      tasks: tasks.all,
      tasks_completed: tasks.done.length,
      tasks_planned: tasks.all.length,
      generated_without_ai: generatedWithoutAi,
      ai_error: aiErrorMessage,
    };

    const { data: report, error: reportInsertError } = await supabase
      .from('reports')
      .insert({
        client_id: client.id,
        agency_id: client.agency_id,
        status: 'draft',
        period_start: periodStartStr,
        period_end: periodEndStr,
        summary_done: reportBlocks.done,
        summary_blockers: reportBlocks.blockers,
        summary_next_steps: reportBlocks.next_steps,
        raw_github_data: rawData,
      })
      .select()
      .single();

    if (reportInsertError || !report) {
      throw new Error(`Failed to save report in database: ${reportInsertError?.message}`);
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
    const d = new Date(periodEndStr + 'T12:00:00Z');
    const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const startOfWeek1 = jan4.getTime() - (jan4.getUTCDay() || 7) * 86400000 + 86400000;
    const weekNum = Math.ceil((d.getTime() - startOfWeek1) / (7 * 86400000)) + 1;
    const sprintCode = `S${weekNum}`;
    const sprintLabel = `Semana ${weekNum}`;
    const completedCount = tasks.done.length;
    const plannedCount = tasks.all.length;

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
        status: 'draft',
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

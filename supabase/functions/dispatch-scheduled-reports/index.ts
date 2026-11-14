// ==============================================================================
// ClientPulse AI — Edge Function: dispatch-scheduled-reports
// File: supabase/functions/dispatch-scheduled-reports/index.ts
//
// PURPOSE:
// Automated batch dispatcher invoked periodically by pg_cron (via pg_net).
// 1. Checks current UTC day of the week and hour.
// 2. Scans the 'clients' table for all clients scheduled for this time window.
// 3. Generates the weekly draft report using Gemini and GitHub Projects v2.
// 4. If the client has 'auto_send_enabled: true' (bypass mode):
//    Dispatches the email immediately to the client without waiting for review!
// 5. If 'auto_send_enabled: false' (default):
//    Leaves the draft in 'reports' with status 'draft' for the manager to review.
//
// SECURITY:
// - Protected by a shared secret header (X-Scheduled-Secret).
// - Rejects any public requests lacking the secret.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';
import { fetchBoardTasks } from '../_shared/github.ts';
import { generateExecutiveReport } from '../_shared/gemini.ts';
import { sendReportEmail } from '../_shared/resend.ts';
import { decryptPat } from '../_shared/crypto.ts';
import { findExistingWeekReport } from '../_shared/idempotency.ts';

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
    // 1. Verify Secret Header (Prevents unauthorized public execution)
    const secret = req.headers.get('X-Scheduled-Secret');
    const expectedSecret = Deno.env.get('SCHEDULED_FUNCTION_SECRET');

    if (!secret || !expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Forbidden: Invalid or missing X-Scheduled-Secret.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Determine Target Day of Week and UTC Hour
    const now = new Date();
    const body = await req.json().catch(() => ({}));

    // Allow overriding in test payloads; default to actual current UTC time
    const targetDay = typeof body.target_day === 'number' ? body.target_day : now.getUTCDay();
    const targetHour = typeof body.target_hour_utc === 'number' ? body.target_hour_utc : now.getUTCHours();

    const supabase = createAdminClient();

    // 3. Query All Clients Matching the Scheduled Time Window
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id,
        agency_id,
        name,
        email,
        company_name,
        communication_tone,
        language,
        github_project_id,
        github_project_title,
        column_mapping,
        auto_send_enabled,
        portal_token,
        agencies:agency_id (
          github_integrations (
            pat_token,
            pat_token_encrypted
          )
        )
      `)
      .eq('schedule_day_of_week', targetDay)
      .eq('schedule_hour_utc', targetHour);

    if (clientsError) {
      throw new Error(`Failed to query scheduled clients: ${clientsError.message}`);
    }

    const scheduledClients = clients ?? [];
    const results = {
      evaluated_time: { day_of_week: targetDay, hour_utc: targetHour },
      total_clients_found: scheduledClients.length,
      drafts_created: 0,
      auto_sent: 0,
      skipped_duplicate: 0,
      details: [] as Array<{
        client_id: string;
        status: string;
        report_id?: string;
        existing_report_id?: string;
      }>,
      errors: [] as Array<{ client_id: string; error: string }>,
    };

    if (scheduledClients.length === 0) {
      return new Response(JSON.stringify({ message: 'No clients scheduled for this window.', ...results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';

    // 4. Process Each Client (Isolated Error Handling per client)
    for (const client of scheduledClients) {
      try {
        // Idempotency: verify if a report already exists for this client in the current ISO week (draft, approved, or sent)
        // A direct send (bypass) or draft must NEVER execute twice for the same client in the same week.
        const { data: existingReports } = await supabase
          .from('reports')
          .select('id, status, period_start, period_end, created_at')
          .eq('client_id', client.id)
          .in('status', ['draft', 'approved', 'sent']);

        const duplicateReport = findExistingWeekReport(existingReports ?? [], now);
        if (duplicateReport) {
          console.log(
            `[dispatch-scheduled-reports] Client '${client.id}' already has a report for this week (report ${duplicateReport.id}, status: ${duplicateReport.status}). Skipping duplicate.`
          );
          results.skipped_duplicate++;
          results.details.push({
            client_id: client.id,
            status: 'skipped_duplicate',
            existing_report_id: duplicateReport.id,
          });
          continue;
        }

        // Extract agency's GitHub PAT
        const agency = Array.isArray(client.agencies) ? client.agencies[0] : client.agencies;
        const integration = Array.isArray(agency?.github_integrations)
          ? agency.github_integrations[0]
          : agency?.github_integrations;

        let patToken: string | null = null;
        if (integration?.pat_token_encrypted) {
          patToken = await decryptPat(integration.pat_token_encrypted);
        } else if (integration?.pat_token) {
          patToken = integration.pat_token;
        }

        if (!patToken) {
          throw new Error('Agency does not have a saved GitHub PAT token.');
        }

        // Fetch cards from GitHub
        const tasks = await fetchBoardTasks(
          patToken,
          client.github_project_id,
          client.column_mapping ?? {},
          7
        );

        // Generate report via Gemini (with graceful fallback)
        let reportBlocks: { done: string; blockers: string; next_steps: string };
        let modelUsed = 'fallback';
        let generatedWithoutAi = false;
        let aiErrorMessage: string | null = null;

        try {
          if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
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
          });
          reportBlocks = aiResult;
          modelUsed = aiResult.modelUsed;
        } catch (aiErr: unknown) {
          generatedWithoutAi = true;
          modelUsed = 'fallback';
          aiErrorMessage = aiErr instanceof Error ? aiErr.message : String(aiErr);
          console.warn(`[dispatch-scheduled-reports] Gemini unavailable for client ${client.id}, falling back:`, aiErrorMessage);

          reportBlocks = {
            done: tasks.done.length > 0
              ? tasks.done.map((t) => `• ${t.title}${t.assignee ? ` (${t.assignee})` : ''}`).join('\n')
              : '• Nenhuma tarefa concluída no período selecionado.',
            blockers: tasks.blocked.length > 0
              ? tasks.blocked.map((t) => `• ${t.title}${t.assignee ? ` (${t.assignee})` : ''}`).join('\n')
              : '• Sem bloqueios registados no board.',
            next_steps: tasks.inProgress.length > 0
              ? tasks.inProgress.map((t) => `• ${t.title}${t.assignee ? ` (${t.assignee})` : ''}`).join('\n')
              : '• Planeamento e definição das próximas atividades em curso.',
          };
        }

        // Period dates
        const periodEnd = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodEnd.getDate() - 7);

        const periodStartStr = periodStart.toISOString().split('T')[0];
        const periodEndStr = periodEnd.toISOString().split('T')[0];

        // Determine initial status: 'sent' ONLY if bypass is enabled AND successfully synthesized with AI
        const isBypass = client.auto_send_enabled === true && !generatedWithoutAi;
        let initialStatus = isBypass ? 'sent' : 'draft';

        let emailDeliveryId = null;
        let sentAtTimestamp = null;

        // If bypass is active, immediately dispatch email
        if (isBypass && client.email) {
          try {
            // Ensure portal token record is active with configured expiration (BE-19)
            if (client.portal_token) {
              try {
                const expirationDays = Number(Deno.env.get('PORTAL_TOKEN_EXPIRATION_DAYS') || '90') || 90;
                const expiresAt = new Date(Date.now() + expirationDays * 86400000).toISOString();
                await supabase
                  .from('portal_tokens')
                  .upsert({
                    client_id: client.id,
                    agency_id: client.agency_id,
                    token: client.portal_token,
                    is_active: true,
                    revoked_at: null,
                    expires_at: expiresAt,
                  }, { onConflict: 'token' });
              } catch (tokenErr) {
                console.warn('[dispatch-scheduled-reports] Failed to ensure portal token record:', tokenErr);
              }
            }

            const emailResult = await sendReportEmail({
              toEmail: client.email,
              clientName: client.name,
              companyName: client.company_name,
              projectTitle: client.github_project_title || client.company_name || client.name,
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
            results.auto_sent++;
          } catch (emailErr: unknown) {
            console.error(`[dispatch-scheduled-reports] Bypass email failed for client ${client.id}:`, emailErr);
            initialStatus = 'failed';
          }
        }

        // Insert report
        const rawReportData = {
          tasks: tasks.all,
          tasks_completed: tasks.done.length,
          tasks_planned: tasks.all.length,
          model_used: modelUsed,
          generated_without_ai: generatedWithoutAi,
          ai_error: aiErrorMessage,
        };

        const { data: newReport, error: insertError } = await supabase
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
            original_summary: {
              done: reportBlocks.done,
              blockers: reportBlocks.blockers,
              next_steps: reportBlocks.next_steps,
            },
            edit_count: 0,
            time_to_approve_seconds: isBypass ? 0 : null,
            raw_github_data: rawReportData,
            approved_at: sentAtTimestamp,
            sent_at: sentAtTimestamp,
            email_delivery_id: emailDeliveryId,
          })
          .select()
          .single();

        if (insertError || !newReport) {
          throw new Error(`Failed to save report: ${insertError?.message}`);
        }

        // Insert tasks for metrics
        if (tasks.all.length > 0) {
          const taskInserts = tasks.all.map((t) => ({
            report_id: newReport.id,
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

        results.drafts_created++;
        results.details.push({
          client_id: client.id,
          status: isBypass ? 'auto_sent' : 'draft_created',
          report_id: newReport.id,
        });
      } catch (clientErr: unknown) {
        const errorMsg = clientErr instanceof Error ? clientErr.message : String(clientErr);
        results.errors.push({
          client_id: client.id,
          error: errorMsg,
        });
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

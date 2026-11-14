// ==============================================================================
// ClientPulse AI — Edge Function: github-sync
// File: supabase/functions/github-sync/index.ts
//
// PURPOSE:
// Provides API endpoints for the dashboard and onboarding flows to:
// 1. 'test-connection': Validate a GitHub PAT and retrieve the user's handle.
// 2. 'list-projects': List all Projects v2 for a given organization or user.
// 3. 'fetch-columns': Get the status columns of a project for custom mapping.
// 4. 'fetch-board-data': Extract the current cards (done, in-progress, blocked).
//
// SECURITY:
// - Protected by CORS headers.
// - Requires a valid Supabase Auth Bearer JWT token from the logged-in agency.
// - Can read stored PAT from the 'github_integrations' table or accept a new one.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createUserClient, createAdminClient, getAuthenticatedUser } from '../_shared/supabaseClient.ts';
import {
  testGitHubToken,
  listProjects,
  fetchProjectColumns,
  fetchBoardTasks,
} from '../_shared/github.ts';
import { encryptPat, decryptPat } from '../_shared/crypto.ts';

Deno.serve(async (req: Request) => {
  // 1. Handle browser CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 2. Verify User Authentication (Supabase Auth JWT)
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid Supabase Auth token.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Parse Request Payload
    const body = await req.json().catch(() => ({}));
    const { action, pat_token, owner, owner_type, project_id, column_mapping, days_ago } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing required 'action' in request body." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Resolve GitHub Personal Access Token (PAT)
    // The caller can provide a PAT directly in the request (e.g. during onboarding),
    // OR we automatically fetch their stored PAT from the database (decrypting if encrypted).
    let token = pat_token?.trim();

    if (!token) {
      // Authenticated user's agency is retrieved using user-scoped client to enforce RLS
      const userClient = createUserClient(req);
      const { data: agency, error: agencyError } = await userClient
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (agencyError || !agency) {
        return new Response(JSON.stringify({ error: 'Agency not found for authenticated user.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Security: Only read PAT columns with adminClient (service role) using agency.id
      // verified by RLS from the agencies table. Never read PAT using an agency_id from the request body.
      const adminClient = createAdminClient();
      const { data: integration, error: dbError } = await adminClient
        .from('github_integrations')
        .select('pat_token, pat_token_encrypted')
        .eq('agency_id', agency.id)
        .maybeSingle();

      if (dbError || (!integration?.pat_token && !integration?.pat_token_encrypted)) {
        return new Response(
          JSON.stringify({
            error: "No GitHub PAT provided and no saved integration found for your agency. Please provide 'pat_token'.",
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (integration.pat_token_encrypted) {
        token = await decryptPat(integration.pat_token_encrypted);
      } else if (integration.pat_token) {
        token = integration.pat_token;
      }
    }

    // 5. Execute Action
    switch (action) {
      // ------------------------------------------------------------------------
      // Action: test-connection
      // ------------------------------------------------------------------------
      case 'test-connection': {
        const result = await testGitHubToken(token);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ------------------------------------------------------------------------
      // Action: save-pat
      // ------------------------------------------------------------------------
      case 'save-pat': {
        const result = await testGitHubToken(token);
        const supabase = createUserClient(req);
        const { data: agency } = await supabase
          .from('agencies')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!agency) {
          return new Response(JSON.stringify({ error: 'Agency not found for authenticated user.' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const encrypted = await encryptPat(token);
        await supabase.from('github_integrations').upsert(
          {
            agency_id: agency.id,
            pat_token: null,
            pat_token_encrypted: encrypted,
            github_username: result.username,
            is_valid: true,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'agency_id' }
        );

        return new Response(JSON.stringify({ success: true, username: result.username }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ------------------------------------------------------------------------
      // Action: list-projects
      // ------------------------------------------------------------------------
      case 'list-projects': {
        let projectOwner = owner ? String(owner).trim() : null;
        let projectOwnerType: 'user' | 'organization' = owner_type === 'organization' ? 'organization' : 'user';

        if (!projectOwner) {
          const ghUser = await testGitHubToken(token);
          projectOwner = ghUser.username;
          projectOwnerType = 'user';
        }

        const projects = await listProjects(token, projectOwner, projectOwnerType);
        return new Response(JSON.stringify({ owner: projectOwner, owner_type: projectOwnerType, projects }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ------------------------------------------------------------------------
      // Action: fetch-columns
      // ------------------------------------------------------------------------
      case 'fetch-columns': {
        if (!project_id) {
          return new Response(JSON.stringify({ error: "Missing 'project_id' (GitHub Project node ID)." }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const columnsData = await fetchProjectColumns(token, project_id);
        return new Response(JSON.stringify(columnsData), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ------------------------------------------------------------------------
      // Action: fetch-board-data
      // ------------------------------------------------------------------------
      case 'fetch-board-data': {
        if (!project_id) {
          return new Response(JSON.stringify({ error: "Missing 'project_id'." }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const tasks = await fetchBoardTasks(token, project_id, column_mapping ?? {}, days_ago ?? 7);
        return new Response(JSON.stringify(tasks), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ------------------------------------------------------------------------
      // Action: sync-metrics
      // ------------------------------------------------------------------------
      case 'sync-metrics': {
        const clientId = body.client_id;
        if (!clientId) {
          return new Response(JSON.stringify({ error: "Missing required 'client_id' parameter." }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const supabase = createUserClient(req);
        const { data: client, error: clientErr } = await supabase
          .from('clients')
          .select('id, agency_id, github_project_id, column_mapping')
          .eq('id', clientId)
          .single();

        if (clientErr || !client) {
          return new Response(JSON.stringify({ error: `Client '${clientId}' not found.` }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tasks = await fetchBoardTasks(
          token,
          client.github_project_id,
          client.column_mapping ?? {},
          days_ago ?? 7
        );

        const now = new Date();
        const jan4 = new Date(Date.UTC(now.getUTCFullYear(), 0, 4));
        const startOfWeek1 = jan4.getTime() - (jan4.getUTCDay() || 7) * 86400000 + 86400000;
        const weekNum = Math.ceil((now.getTime() - startOfWeek1) / (7 * 86400000)) + 1;
        const sprintCode = `S${weekNum}`;
        const sprintLabel = `Semana ${weekNum}`;

        const { data: metric, error: metricErr } = await supabase
          .from('sprint_metrics')
          .upsert({
            client_id: client.id,
            agency_id: client.agency_id,
            sprint: sprintCode,
            label: sprintLabel,
            completed: tasks.done.length,
            planned: tasks.all.length,
            updated_at: now.toISOString(),
          }, { onConflict: 'client_id,sprint' })
          .select()
          .single();

        if (metricErr) {
          throw new Error(`Failed to save sprint metric: ${metricErr.message}`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            client_id: client.id,
            metric,
            tasks_count: {
              total: tasks.all.length,
              done: tasks.done.length,
              in_progress: tasks.inProgress.length,
              blocked: tasks.blocked.length,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default: {
        return new Response(
          JSON.stringify({
            error: `Unknown action '${action}'. Valid actions are: test-connection, list-projects, fetch-columns, fetch-board-data, sync-metrics.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const status = message.includes('401') ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

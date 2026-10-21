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
import { createUserClient, getAuthenticatedUser } from '../_shared/supabaseClient.ts';
import {
  testGitHubToken,
  listProjects,
  fetchProjectColumns,
  fetchBoardTasks,
} from '../_shared/github.ts';

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
    // OR we automatically fetch their stored PAT from the database.
    let token = pat_token?.trim();

    if (!token) {
      const supabase = createUserClient(req);
      const { data: integration, error: dbError } = await supabase
        .from('github_integrations')
        .select('pat_token')
        .limit(1)
        .maybeSingle();

      if (dbError || !integration?.pat_token) {
        return new Response(
          JSON.stringify({
            error: "No GitHub PAT provided and no saved integration found for your agency. Please provide 'pat_token'.",
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      token = integration.pat_token;
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
      // Action: list-projects
      // ------------------------------------------------------------------------
      case 'list-projects': {
        if (!owner) {
          return new Response(
            JSON.stringify({ error: "Missing 'owner' (GitHub organization or username)." }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const projects = await listProjects(token, owner, owner_type ?? 'user');
        return new Response(JSON.stringify({ owner, owner_type: owner_type ?? 'user', projects }), {
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

      default: {
        return new Response(
          JSON.stringify({
            error: `Unknown action '${action}'. Valid actions are: test-connection, list-projects, fetch-columns, fetch-board-data.`,
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

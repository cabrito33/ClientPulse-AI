// ==============================================================================
// ClientPulse AI — Edge Function: onboarding-chat
// File: supabase/functions/onboarding-chat/index.ts
//
// PURPOSE:
// Conversational AI Onboarding Assistant (Chatbot & Voice Bot backend).
// Guides a new agency user through:
// 1. Explaining the 3-step setup in under 5 minutes.
// 2. Prompting for their GitHub Fine-Grained Personal Access Token (PAT).
// 3. Testing and validating the token in real time against the GitHub GraphQL API.
// 4. Automatically saving the verified token to 'github_integrations'.
// 5. Guiding the user to select their project board and register their first client.
//
// VOICE NOTE:
// Voice recognition (Speech-to-Text) and speech synthesis (Text-to-Speech)
// run in the client's browser using the native Web Speech API.
// This function receives clean text and returns clean conversational text & JSON.
//
// SECURITY:
// - Protected by CORS headers.
// - Requires authenticated agency user (Supabase JWT).
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createUserClient, getAuthenticatedUser } from '../_shared/supabaseClient.ts';
import { testGitHubToken } from '../_shared/github.ts';
import { encryptPat } from '../_shared/crypto.ts';

interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

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
    // 1. Authenticate Agency User
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid Supabase Auth token.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createUserClient(req);

    // 2. Parse Request Payload
    const body = await req.json().catch(() => ({}));
    const { message, conversation_history } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: "Missing required 'message' string in request body." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const history: ChatMessage[] = Array.isArray(conversation_history) ? conversation_history : [];

    // 3. Check for GitHub PAT in User Message
    // Matches GitHub fine-grained tokens (github_pat_...) or classic tokens (ghp_...)
    const patRegex = /(github_pat_[a-zA-Z0-9_]{30,}|ghp_[a-zA-Z0-9]{36,})/;
    const patMatch = message.match(patRegex);

    let tokenValidationResult: {
      attempted: boolean;
      success: boolean;
      username?: string;
      error?: string;
    } = { attempted: false, success: false };

    if (patMatch) {
      const extractedPat = patMatch[0];
      tokenValidationResult.attempted = true;

      try {
        const ghUser = await testGitHubToken(extractedPat);
        tokenValidationResult.success = true;
        tokenValidationResult.username = ghUser.username;

        // Automatically store or update the verified PAT in database for this agency (encrypted in repose)
        const { data: agency } = await supabase
          .from('agencies')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (agency) {
          const encryptedPat = await encryptPat(extractedPat);
          await supabase.from('github_integrations').upsert(
            {
              agency_id: agency.id,
              pat_token: null,
              pat_token_encrypted: encryptedPat,
              github_username: ghUser.username,
              is_valid: true,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'agency_id' }
          );
        }
      } catch (err: unknown) {
        tokenValidationResult.success = false;
        tokenValidationResult.error = err instanceof Error ? err.message : String(err);
      }
    }

    // 4. Check if Agency Already Has a Valid GitHub Integration
    const { data: existingIntegration } = await supabase
      .from('github_integrations')
      .select('github_username, is_valid')
      .maybeSingle();

    const isConnected = existingIntegration?.is_valid || tokenValidationResult.success;
    const connectedUsername = tokenValidationResult.username || existingIntegration?.github_username;

    // 5. Build System Instruction for Gemini Assistant
    const systemInstruction = `
You are PulseBot, the friendly, efficient conversational onboarding assistant for ClientPulse AI.

YOUR ROLE:
Guide new freelancers and agency owners to complete their initial onboarding in under 5 minutes.
You speak clearly, warmly, and concisively (2-4 sentences per response max, perfect for both reading and voice playback via Text-to-Speech).

ONBOARDING WORKFLOW (Step-by-step):
1. Greet the user warmly and introduce ClientPulse AI (weekly automated reports from GitHub Projects).
2. Ask the user to connect their GitHub account using a Personal Access Token (PAT) with 'read:project' scope.
3. Once the token is connected, congratulate them and ask for the project board they want to report on (e.g., organization/user name and board title).
4. Guide them to register their first client: Client Name, Email, preferred Tone (Formal, Executive, or Casual), and Language (Portuguese or English).
5. Conclude by confirming that everything is ready for their first Friday report!

CURRENT SYSTEM CONTEXT:
- GitHub Connected: ${isConnected ? `YES (Connected to @${connectedUsername})` : 'NO (Awaiting token)'}
${
  tokenValidationResult.attempted
    ? tokenValidationResult.success
      ? `- JUST VALIDATED: Token validated successfully for user @${tokenValidationResult.username}! Acknowledge this with enthusiasm.`
      : `- TOKEN FAILED: The token provided was invalid or lacked permissions: "${tokenValidationResult.error}". Explain politely how to generate a token with 'read:project' permissions.`
    : ''
}

LANGUAGE:
- Match the language of the user's message (Portuguese by default, English if addressed in English).
`;

    // 6. Build Conversation Payload for Gemini
    const contents = [];

    // Include recent history (up to last 10 turns)
    const recentHistory = history.slice(-10);
    for (const h of recentHistory) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      });
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    // 7. Invoke Gemini API
    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
        generationConfig: {
          temperature: 0.7, // Slightly warmer for friendly conversational voice
          topP: 0.9,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Gemini Chat Error (HTTP ${geminiResponse.status}): ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const assistantReply =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Olá! Estou pronto para ajudar na configuração da tua conta do ClientPulse AI.';

    // 8. Determine Action Detected for Frontend UI Updates
    let actionDetected: { action: string; data?: Record<string, unknown> } | null = null;

    if (tokenValidationResult.success) {
      actionDetected = {
        action: 'pat_validated',
        data: {
          username: tokenValidationResult.username,
          connected: true,
        },
      };
    } else if (tokenValidationResult.attempted && !tokenValidationResult.success) {
      actionDetected = {
        action: 'pat_failed',
        data: {
          error: tokenValidationResult.error,
        },
      };
    } else if (isConnected) {
      actionDetected = {
        action: 'awaiting_client_details',
        data: {
          username: connectedUsername,
        },
      };
    } else {
      actionDetected = {
        action: 'awaiting_pat',
      };
    }

    // 9. Return Response
    return new Response(
      JSON.stringify({
        reply: assistantReply,
        action_detected: actionDetected,
        github_status: {
          is_connected: isConnected,
          username: connectedUsername ?? null,
        },
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

// ==============================================================================
// ClientPulse AI — Edge Function: onboarding-chat
// File: supabase/functions/onboarding-chat/index.ts
// Issue: [BE-27] [P1] [L] Chatbot de onboarding e FAQ (US02) #47
//
// PURPOSE:
// Conversational AI Onboarding Assistant & FAQ (PulseBot) with LLM.
// 1. Guides initial setup: GitHub PAT -> Column Mapping -> First Client profile.
// 2. Answers product FAQs based on official PRD & architecture documentation.
// 3. Strictly validates GitHub connection before allowing user to advance.
// 4. Enforces guardrails to refuse any out-of-scope questions.
//
// SECURITY:
// - Protected by CORS headers.
// - Supports both authenticated users and initial setup requests.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createUserClient, getAuthenticatedUser } from '../_shared/supabaseClient.ts';
import { testGitHubToken } from '../_shared/github.ts';

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
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const { message, conversation_history } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: "Missing required 'message' string in request body." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const history: ChatMessage[] = Array.isArray(conversation_history) ? conversation_history : [];

    // --------------------------------------------------------------------------
    // 1. Real-time GitHub PAT Detection and Validation
    // --------------------------------------------------------------------------
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

        // Save to database if user is authenticated
        if (user) {
          const supabase = createUserClient(req);
          const { data: agency } = await supabase
            .from('agencies')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (agency) {
            await supabase.from('github_integrations').upsert(
              {
                agency_id: agency.id,
                pat_token: extractedPat,
                github_username: ghUser.username,
                is_valid: true,
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: 'agency_id' }
            );
          }
        }
      } catch (err: unknown) {
        tokenValidationResult.success = false;
        tokenValidationResult.error = err instanceof Error ? err.message : String(err);
      }
    }

    // Check existing connection state
    let isConnected = tokenValidationResult.success;
    let connectedUsername = tokenValidationResult.username;

    if (user && !isConnected) {
      const supabase = createUserClient(req);
      const { data: existingIntegration } = await supabase
        .from('github_integrations')
        .select('github_username, is_valid')
        .maybeSingle();

      if (existingIntegration?.is_valid) {
        isConnected = true;
        connectedUsername = existingIntegration.github_username ?? undefined;
      }
    }

    // --------------------------------------------------------------------------
    // 2. Comprehensive System Instruction with Knowledge Base & Guardrails
    // --------------------------------------------------------------------------
    const systemInstruction = `
You are PulseBot, the dedicated intelligent onboarding and support assistant for ClientPulse AI.

PRODUCT KNOWLEDGE BASE (Source of Truth):
1. WHAT IS CLIENTPULSE AI?
   - A B2B SaaS platform that automates weekly progress reporting for freelance developers and small agencies (2–10 people).
   - Integrates directly with GitHub Projects v2 via GraphQL API.
   - Synthesizes completed deliverables, blockers, and next steps into clear business language using Google Gemini AI, free of technical jargon.
   - Structured strictly in 3 executive blocks:
     * "done" (O que foi feito / Entregas)
     * "blockers" (Bloqueios / Pontos de atenção a requerer decisão do cliente)
     * "next_steps" (Próximos passos / Prioridades da próxima sprint)
   - Reports are delivered via email (Resend) and hosted on a Zero-Login Client Portal (/portal?token=UUID).
   - Zero-Login Portal: Read-only, unguessable secure token, displays the week's report, history, and sprint velocity chart. Clients never need to create passwords or remember credentials.
   - Privacy & Security: The system NEVER accesses, clones, or stores repository source code. It strictly reads issue and card metadata (titles, status, assignees, labels).

2. ONBOARDING WORKFLOW (Step-by-step guidance):
   - Step 1 (GitHub Connection): Guide user to provide a GitHub Fine-Grained Personal Access Token (PAT) with 'read:project' and 'repo' read-only scope.
     * MANDATORY VALIDATION: You must NOT allow the user to advance past Step 1 until a valid token has been verified.
   - Step 2 (Board & Column Mapping): Guide user to select their ProjectV2 board and map columns (e.g. "Done" -> Concluído, "In Progress" -> Em curso, "Blocked" -> Bloqueado).
   - Step 3 (First Client Profile): Guide user to enter Client Name, Company, Email, preferred Tone (Formal, Executive, Casual), and Language (Portuguese or English).
   - Step 4 (Finish): Congratulate the user, confirm their automated Friday delivery schedule, and invite them to review their first draft.

3. FREQUENTLY ASKED QUESTIONS (FAQ):
   - Q: "Vocês lêem o código do meu cliente?" -> R: "Não! Por motivos éticos e de segurança, acedemos exclusivamente aos metadados do GitHub Projects (títulos, estados e etiquetas). O código-fonte nunca é lido nem armazenado."
   - Q: "O cliente precisa de criar conta para ver o portal?" -> R: "Não. O cliente recebe um link exclusivo e seguro com token UUIDv4. A página é de leitura simples, sem necessidade de logins ou palavras-passe."
   - Q: "E se a IA inventar uma tarefa que não existe?" -> R: "O nosso motor utiliza regras estritas anti-alucinação e temperatura baixa (0.2), baseando-se unicamente nas tarefas reais do quadro. Além disso, os relatórios ficam em rascunho para aprovação prévia do gestor."
   - Q: "Suporta Trello ou Jira?" -> R: "Nesta versão MVP o foco exclusivo é o GitHub Projects v2. Integrações com Trello e Jira estão planeadas para o pós-MVP."

4. STRICT SCOPE GUARDRAILS (CRITICAL):
   - You ONLY answer questions related to ClientPulse AI, onboarding, GitHub Projects integration, reporting, and product FAQs.
   - IF THE USER ASKS ANY OUT-OF-SCOPE QUESTION (e.g. coding unrelated algorithms, recipes, sports, weather, creative writing, jokes, personal opinions):
     YOU MUST POLITELY REFUSE:
     "O meu papel é ajudar-te exclusivamente na configuração do ClientPulse AI, na integração com o GitHub Projects e na resposta a dúvidas sobre o produto. Como posso ajudar com o teu onboarding ou com a tua conta?"

SYSTEM CONTEXT FOR THIS CONVERSATION:
- GitHub Connected: ${isConnected ? `YES (Connected to user @${connectedUsername})` : 'NO (Awaiting valid token)'}
${
  tokenValidationResult.attempted
    ? tokenValidationResult.success
      ? `- EVENT: Token validated successfully for user @${tokenValidationResult.username}! Celebrate this and proceed to Step 2 (selecting board and mapping columns).`
      : `- EVENT: Token validation failed: "${tokenValidationResult.error}". Inform the user politely and explain how to create a token with 'read:project' permissions.`
    : ''
}

TONE AND STYLE:
- Professional, welcoming, concise, and helpful (2 to 4 sentences per message max).
- Match the language of the user (Portuguese by default; English if spoken in English).
`;

    // --------------------------------------------------------------------------
    // 3. Assemble Conversation History for Gemini
    // --------------------------------------------------------------------------
    const contents = [];
    const recentHistory = history.slice(-8);

    for (const h of recentHistory) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // --------------------------------------------------------------------------
    // 4. Call Google Gemini API
    // --------------------------------------------------------------------------
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    let assistantReply = 'Olá! Sou o PulseBot. Como posso ajudar no teu onboarding do ClientPulse AI?';

    if (geminiApiKey) {
      const geminiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 350,
          },
        }),
      });

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) assistantReply = text;
      }
    }

    // --------------------------------------------------------------------------
    // 5. Structure Action Response for Frontend UI State
    // --------------------------------------------------------------------------
    let actionDetected: { action: string; data?: Record<string, unknown> } | null = null;

    if (tokenValidationResult.success) {
      actionDetected = {
        action: 'pat_validated',
        data: {
          username: tokenValidationResult.username,
          connected: true,
          next_step: 2,
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
        action: 'ready_for_step_2',
        data: {
          username: connectedUsername,
        },
      };
    } else {
      actionDetected = {
        action: 'awaiting_pat',
      };
    }

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

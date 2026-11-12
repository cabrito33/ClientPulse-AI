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

const OUT_OF_SCOPE_REFUSAL_PT =
  'O meu papel é ajudar-te exclusivamente na configuração do ClientPulse AI, na integração com o GitHub Projects e na resposta a dúvidas sobre o produto. Como posso ajudar com o teu onboarding ou com a tua conta?';

const OUT_OF_SCOPE_REFUSAL_EN =
  'My role is exclusively to help you set up ClientPulse AI, integrate GitHub Projects, and answer questions about the product. How can I assist you with your onboarding or account?';

/**
 * Checks if the message is outside the product scope.
 * (Criterion 4)
 */
function isOutOfScope(message: string): boolean {
  const lower = message.toLowerCase().trim();

  const outOfScopePatterns = [
    /receita\s+de/i,
    /bolo\s+de/i,
    /como\s+(cozinhar|fazer\s+pão|fazer\s+arroz)/i,
    /quicksort/i,
    /bubble\s*sort/i,
    /fibonacci/i,
    /árvore\s+binária|arvore\s+binaria/i,
    /algoritmo\s+em\s+(c\+\+|java|python|c#|rust)/i,
    /código\s+para\s+inverter\s+uma\s+string/i,
    /capital\s+da\s+(frança|espanha|alemanha|itália)/i,
    /previsão\s+do\s+tempo|tempo\s+amanhã|clima\s+em/i,
    /quem\s+ganhou\s+o\s+jogo|futebol|benfica|porto|sporting/i,
    /poema\s+sobre|história\s+de\s+amor/i,
    /conta\s+uma\s+anedota|piada/i,
    /política|eleições|presidente/i,
    /escreve\s+um\s+ensaio\s+sobre/i,
  ];

  for (const pattern of outOfScopePatterns) {
    if (pattern.test(lower)) return true;
  }

  const inScopeKeywords = [
    'clientpulse', 'github', 'pat', 'token', 'onboarding', 'relatório', 'relatorio',
    'report', 'cliente', 'coluna', 'mapear', 'mapeamento', 'sprint', 'board', 'projeto',
    'gemini', 'ia', 'ai', 'portal', 'zero-login', 'email', 'resend', 'agendamento', 'faq',
    'bloqueio', 'proximo passo', 'próximo passo', 'trello', 'notion', 'jira', 'login', 'conta',
    'ajuda', 'setup', 'olá', 'ola', 'passo', 'step', 'avançar', 'avanca',
  ];

  if (!inScopeKeywords.some((kw) => lower.includes(kw)) && lower.length > 20) {
    const genericQuestionTriggers = [
      'quanto é', 'calcula', 'como resolver', 'física', 'química', 'traduz para',
    ];
    if (genericQuestionTriggers.some((t) => lower.includes(t))) return true;
  }

  return false;
}

/**
 * Checks if user is asking to advance to next steps.
 * (Criterion 3)
 */
function isAdvanceIntent(message: string): boolean {
  const lower = message.toLowerCase().trim();
  const advancePatterns = [
    /avançar|avanca|avancar/i,
    /passo\s+seguinte/i,
    /proximo\s+passo|próximo\s+passo/i,
    /passo\s+2|step\s+2/i,
    /passo\s+3|step\s+3/i,
    /ir\s+para\s+as?\s+colunas/i,
    /mapear\s+colunas/i,
    /criar\s+(o\s+)?(primeiro\s+)?cliente/i,
    /perfil\s+de\s+cliente/i,
    /pular|saltar|skip/i,
    /continuar/i,
    /posso\s+avançar|posso\s+avancar/i,
    /next\s+step/i,
  ];

  return advancePatterns.some((pattern) => pattern.test(lower));
}

/**
 * Fallback documentation answers when Gemini API is unavailable or offline.
 */
function getDocumentationFaqReply(
  message: string,
  isConnected: boolean,
  username?: string | null
): { reply: string; action: string } | null {
  const lower = message.toLowerCase();

  if (
    lower.includes('lêem o código') ||
    lower.includes('leem o codigo') ||
    lower.includes('código-fonte') ||
    lower.includes('codigo-fonte') ||
    lower.includes('privacidade') ||
    lower.includes('repositório')
  ) {
    return {
      reply:
        'Não! Por motivos éticos e de segurança, o ClientPulse AI acede exclusivamente aos metadados do GitHub Projects v2 (títulos das tarefas, colunas, etiquetas e responsáveis). O código-fonte dos teus repositórios nunca é lido, clonado nem armazenado.',
      action: 'faq_answered',
    };
  }

  if (
    lower.includes('login') ||
    lower.includes('conta') ||
    lower.includes('portal') ||
    lower.includes('palavra-passe') ||
    lower.includes('password') ||
    lower.includes('precisa de login')
  ) {
    return {
      reply:
        'O teu cliente não precisa de criar conta nem de fazer login. Cada relatório enviado por e-mail contém uma ligação segura com um token UUIDv4 exclusivo. O Portal do Cliente é uma vista web moderna, simples e só de leitura com o relatório da semana, histórico e gráfico de tarefas por sprint.',
      action: 'faq_answered',
    };
  }

  if (
    lower.includes('inventar') ||
    lower.includes('alucina') ||
    lower.includes('alucinação') ||
    lower.includes('alucinacao') ||
    lower.includes('precisão')
  ) {
    return {
      reply:
        'O nosso motor utiliza o Google Gemini 2.5 Flash com temperatura baixa (0.2) e regras rigorosas anti-alucinação: a IA só sintetiza tarefas que existam de facto no quadro do GitHub. Além disso, o relatório fica em rascunho no dashboard para poderes rever e editar antes de o aprovar.',
      action: 'faq_answered',
    };
  }

  if (
    lower.includes('como funciona o envio') ||
    lower.includes('envio') ||
    lower.includes('agendamento') ||
    lower.includes('aprovação') ||
    lower.includes('aprovacao') ||
    lower.includes('bypass')
  ) {
    return {
      reply:
        "Por defeito, o ClientPulse AI compila os relatórios às sextas-feiras. O gestor recebe um aviso no Dashboard para rever o rascunho de 3 blocos e clicar em 'Aprovar e Enviar'. Se preferires automatizar a 100%, podes ativar o modo 'Bypass (Envio Direto)' nas definições do cliente.",
      action: 'faq_answered',
    };
  }

  if (
    lower.includes('trello') ||
    lower.includes('jira') ||
    lower.includes('notion') ||
    lower.includes('clickup') ||
    lower.includes('asana')
  ) {
    return {
      reply:
        'No MVP atual, a única fonte de dados suportada é o GitHub Projects v2. Integrações com Trello, Notion e Jira estão planeadas como evolução futura pós-MVP.',
      action: 'faq_answered',
    };
  }

  if (
    lower.includes('colunas') ||
    lower.includes('mapeamento') ||
    lower.includes('mapear') ||
    lower.includes('estados')
  ) {
    if (!isConnected) {
      return {
        reply:
          "Para configurares o mapeamento de colunas, precisamos de validar primeiro a tua ligação ao GitHub. Introduz o teu Personal Access Token (PAT) com a permissão 'read:project'.",
        action: 'blocked_requires_pat',
      };
    }
    return {
      reply:
        `Ótimo! Com o GitHub ligado (${username ? `@${username}` : 'ativo'}), no Passo 2 associas as colunas do teu GitHub Project aos 3 estados do ClientPulse: 'Concluído' (para 'O que foi feito'), 'Em curso' (para 'Próximos passos') e 'Bloqueado' (para 'Atenção e Bloqueios'). Queres avançar para a criação do cliente?`,
      action: 'guide_columns',
    };
  }

  if (
    lower.includes('cliente') ||
    lower.includes('perfil') ||
    lower.includes('tom') ||
    lower.includes('idioma')
  ) {
    if (!isConnected) {
      return {
        reply:
          'Antes de criar o perfil do teu primeiro cliente, precisamos de validar a ligação ao GitHub. Por favor, introduz o teu Personal Access Token.',
        action: 'blocked_requires_pat',
      };
    }
    return {
      reply:
        'No Passo 3 defines o nome da empresa ou cliente, o e-mail de destino, o idioma (Português de Portugal ou Inglês) e o tom do relatório (Formal, Executivo ou Casual). A IA adapta automaticamente a escrita ao perfil escolhido!',
      action: 'guide_client',
    };
  }

  if (
    lower.includes('criar pat') ||
    lower.includes('gerar pat') ||
    lower.includes('obter token') ||
    lower.includes('onde crio')
  ) {
    return {
      reply:
        "Para gerar o teu Personal Access Token no GitHub: vai a GitHub > Settings > Developer Settings > Personal Access Tokens > Fine-grained tokens. Cria um token com permissão de leitura em 'read:project' e 'repo' (leitura de metadados). Depois copia-o e cola-o aqui!",
      action: 'awaiting_pat',
    };
  }

  return null;
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
    const { message, conversation_history, pat_token, is_connected, connected_username } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: "Missing required 'message' string in request body." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const history: ChatMessage[] = Array.isArray(conversation_history) ? conversation_history : [];

    // --------------------------------------------------------------------------
    // Criterion 4: Strict Scope Guardrail Refusal
    // --------------------------------------------------------------------------
    if (isOutOfScope(message)) {
      const isEnglish = /\b(what|how|weather|recipe|joke|capital|write|code|algorithm)\b/i.test(message);
      return new Response(
        JSON.stringify({
          reply: isEnglish ? OUT_OF_SCOPE_REFUSAL_EN : OUT_OF_SCOPE_REFUSAL_PT,
          action_detected: {
            action: 'out_of_scope_refusal',
            message: 'A pergunta encontra-se fora do âmbito do produto.',
          },
          github_status: {
            is_connected: Boolean(is_connected),
            username: connected_username ?? null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --------------------------------------------------------------------------
    // Criterion 2 & 3: Real-time GitHub PAT Detection and Validation
    // --------------------------------------------------------------------------
    const patRegex = /(github_pat_[a-zA-Z0-9_]{15,}|ghp_[a-zA-Z0-9]{20,}|demo_pat_[a-zA-Z0-9_]+)/i;
    const patMatch = pat_token ? [pat_token] : message.match(patRegex);

    let tokenAttempted = false;
    let tokenSuccess = false;
    let tokenUsername: string | undefined;
    let tokenError: string | undefined;

    if (patMatch) {
      const extractedPat = patMatch[0].trim();
      tokenAttempted = true;

      try {
        const ghUser = await testGitHubToken(extractedPat);
        tokenSuccess = true;
        tokenUsername = ghUser.username;

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
        tokenSuccess = false;
        tokenError = err instanceof Error ? err.message : String(err);
      }
    }

    // Check existing connection state
    let isConnected = tokenSuccess || Boolean(is_connected);
    let currentUsername = tokenUsername || connected_username;

    if (user && !isConnected) {
      const supabase = createUserClient(req);
      const { data: existingIntegration } = await supabase
        .from('github_integrations')
        .select('github_username, is_valid')
        .maybeSingle();

      if (existingIntegration?.is_valid) {
        isConnected = true;
        currentUsername = existingIntegration.github_username ?? undefined;
      }
    }

    // --------------------------------------------------------------------------
    // Criterion 3: Block advancement if GitHub is NOT connected
    // --------------------------------------------------------------------------
    if (!isConnected && isAdvanceIntent(message) && !tokenSuccess) {
      return new Response(
        JSON.stringify({
          reply:
            "Para avançar para o mapeamento de colunas e para a criação do primeiro cliente, é obrigatório validar primeiro a ligação ao GitHub. Por favor, introduz o teu Personal Access Token (PAT) com permissão 'read:project' para verificarmos a conexão.",
          action_detected: {
            action: 'blocked_requires_pat',
            message: 'Ligação ao GitHub obrigatória antes de avançar.',
          },
          github_status: {
            is_connected: false,
            username: null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If PAT was validated on this turn
    if (tokenAttempted && tokenSuccess) {
      return new Response(
        JSON.stringify({
          reply:
            `Excelente! Validei o teu token com sucesso para o utilizador @${tokenUsername}. A ligação ao GitHub está confirmada! Agora no Passo 2, vamos mapear as colunas do teu quadro (Done, In Progress, Blocked). Tens alguma dúvida sobre como funciona o mapeamento?`,
          action_detected: {
            action: 'pat_validated',
            data: {
              username: tokenUsername,
              connected: true,
              next_step: 2,
            },
          },
          github_status: {
            is_connected: true,
            username: tokenUsername ?? null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If PAT was attempted but failed
    if (tokenAttempted && !tokenSuccess) {
      return new Response(
        JSON.stringify({
          reply:
            `Não consegui validar esse token do GitHub (${tokenError || 'credenciais inválidas'}). Verifica se o token tem permissão de leitura em 'read:project' e 'repo' e tenta novamente.`,
          action_detected: {
            action: 'pat_failed',
            data: {
              error: tokenError,
            },
          },
          github_status: {
            is_connected: false,
            username: null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --------------------------------------------------------------------------
    // Criterion 1: Documentation Knowledge Base & LLM System Instruction
    // --------------------------------------------------------------------------
    const systemInstruction = `
You are PulseBot, the dedicated intelligent onboarding and support assistant for ClientPulse AI.

PRODUCT KNOWLEDGE BASE (Source of Truth):
1. WHAT IS CLIENTPULSE AI?
   - A B2B SaaS platform that automates weekly progress reporting for freelance developers and small agencies (2–10 people).
   - Problem: Freelancers spend 2-3 hours/week writing status reports and answering anxious client messages.
   - Solution: Integrates directly with GitHub Projects v2 via GraphQL API.
   - Synthesizes completed deliverables, blockers, and next steps into clear business language using Google Gemini AI, free of technical jargon.
   - Structured strictly in 3 executive blocks:
     * "done" (O que foi feito / Entregas de valor de negócio)
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
   - Q: "Como funciona o envio?" -> R: "Os relatórios são gerados e enviados semanalmente às sextas-feiras com paragem para aprovação no Dashboard, ou envio direto com modo Bypass ativado."

4. STRICT SCOPE GUARDRAILS (CRITICAL):
   - You ONLY answer questions related to ClientPulse AI, onboarding, GitHub Projects integration, reporting, and product FAQs.
   - IF THE USER ASKS ANY OUT-OF-SCOPE QUESTION (e.g. coding unrelated algorithms, recipes, sports, weather, creative writing, jokes, personal opinions):
     YOU MUST POLITELY REFUSE:
     "${OUT_OF_SCOPE_REFUSAL_PT}"

SYSTEM CONTEXT FOR THIS CONVERSATION:
- GitHub Connected: ${isConnected ? `YES (Connected to user @${currentUsername})` : 'NO (Awaiting valid token)'}

TONE AND STYLE:
- Professional, welcoming, concise, and helpful (2 to 4 sentences per message max).
- Match the language of the user (Portuguese by default; English if spoken in English).
`;

    // --------------------------------------------------------------------------
    // 4. Call Google Gemini API (gemini-2.5-flash)
    // --------------------------------------------------------------------------
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    let assistantReply: string | null = null;

    if (geminiApiKey) {
      try {
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

        const geminiResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents,
            generationConfig: {
              temperature: 0.3,
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
      } catch {
        // Fallback to documentation matcher
      }
    }

    // Fallback if Gemini not available
    let actionType = isConnected ? 'guide_columns' : 'awaiting_pat';

    if (!assistantReply) {
      const docFaq = getDocumentationFaqReply(message, isConnected, currentUsername);
      if (docFaq) {
        assistantReply = docFaq.reply;
        actionType = docFaq.action;
      } else {
        assistantReply = isConnected
          ? `A tua ligação ao GitHub está ativa (@${currentUsername}). Estamos no Passo 2 (Mapeamento de Colunas) e Passo 3 (Perfil de Cliente). Como posso ajudar?`
          : "Olá! Sou o PulseBot. Para começarmos o setup do ClientPulse AI, introduz o teu Personal Access Token (PAT) do GitHub com permissão 'read:project'. Se tiveres dúvidas sobre segurança ou sobre o portal, estou aqui para ajudar!";
      }
    }

    return new Response(
      JSON.stringify({
        reply: assistantReply,
        action_detected: {
          action: actionType,
          data: {
            username: currentUsername ?? null,
            connected: isConnected,
          },
        },
        github_status: {
          is_connected: isConnected,
          username: currentUsername ?? null,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

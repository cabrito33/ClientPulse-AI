/**
 * ==============================================================================
 * ClientPulse AI — Conversational Onboarding Assistant & FAQ Engine (PulseBot)
 * File: src/lib/onboarding-bot.ts
 * Issue: [BE-27] [P1] [L] Chatbot de onboarding e FAQ (US02) #47
 *
 * CRITÉRIOS DE ACEITAÇÃO:
 * 1. Endpoint de chat com contexto da documentação do produto (PRD, Arquitetura, FAQ)
 * 2. Guia a ligação ao GitHub, o mapeamento de colunas e a criação do 1º cliente
 * 3. Valida que a ligação ao GitHub funciona antes de avançar
 * 4. Recusa perguntas fora do âmbito
 * ==============================================================================
 */

export interface ChatMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

export interface ActionDetected {
  action:
    | "awaiting_pat"
    | "pat_validated"
    | "pat_failed"
    | "blocked_requires_pat"
    | "guide_columns"
    | "guide_client"
    | "out_of_scope_refusal"
    | "faq_answered";
  data?: Record<string, unknown>;
  message?: string;
}

export interface ChatbotResponse {
  reply: string;
  action_detected: ActionDetected;
  github_status: {
    is_connected: boolean;
    username: string | null;
  };
}

export interface ProcessChatOptions {
  message: string;
  conversation_history?: ChatMessage[];
  pat_token?: string;
  is_connected?: boolean;
  connected_username?: string | null;
}

/**
 * Knowledge Base extracted directly from docs/PRD.md, docs/ARCHITECTURE.md, docs/API.md
 */
export const PRODUCT_DOCUMENTATION_KNOWLEDGE = `
PRODUCT KNOWLEDGE BASE (ClientPulse AI):
1. WHAT IS CLIENTPULSE AI?
   - A B2B SaaS platform automating weekly progress reporting for freelance developers and small digital agencies (2–10 people).
   - Problem solved: Freelancers spend 2-3 hours/week compiling status updates, translating technical jargon, and answering anxious client messages on Slack/WhatsApp.
   - Solution: Connects to GitHub Projects v2 via GraphQL, extracts task metadata (completed, in-progress, blocked), and uses Google Gemini AI to synthesize a clear executive summary without technical jargon.
   - Saves 2 to 3 hours per client/week, reducing client anxiety and preventing scope/delivery misunderstandings.

2. STRUCTURE OF THE WEEKLY REPORT (MANDATORY 3 BLOCKS):
   - Block 1: "done" (O que foi feito / Entregas) - Tangible business value delivered in the week.
   - Block 2: "blockers" (Bloqueios e pontos de atenção) - Impediments or external dependencies requiring client decision.
   - Block 3: "next_steps" (Próximos passos / Prioridades) - Key priorities planned for the upcoming sprint.
   - Strict rule: No technical jargon (commits, branches, PR numbers, stack traces).

3. ZERO-LOGIN CLIENT PORTAL (/portal/[token]):
   - The end client receives an email with an executive summary and a secure, unguessable UUIDv4 link (/portal?token=UUID).
   - Zero-Login: The client NEVER needs to create an account, register, or remember passwords.
   - Read-only interface showing: Current week's report, past report history, and sprint velocity chart (tasks completed per sprint).

4. PRIVACY, ETHICS & DATA ACCESS (STRICT):
   - The system NEVER accesses, clones, reads, or stores repository source code or commit diffs.
   - It strictly reads issue and card metadata via GraphQL: titles, column statuses, labels, and assignees.

5. AI ENGINE & ANTI-HALLUCINATION GUARDRAILS:
   - Powered by Google Gemini 2.5 Flash.
   - Low temperature (0.2) for high factual consistency.
   - Mandatory human-in-the-loop: Reports are generated as drafts on the agency dashboard for manual review and editing before being sent ("Aprovar e Enviar").
   - Optional "Bypass Mode" can be enabled for automated direct sending without manual review.
   - Automatic scheduler: Weekly reports dispatched on Fridays at 09:00 UTC (or custom configured time) via pg_cron and Resend email service.

6. INTEGRATIONS:
   - GitHub Projects v2 is the single data source for the MVP.
   - Trello, Notion, and Jira are scheduled for post-MVP future evolution.

7. ONBOARDING 4-STEP WORKFLOW:
   - Step 1 (GitHub Connection): Personal Access Token (PAT) with 'read:project' and 'repo' (read-only) scope.
     * MANDATORY GATE: User CANNOT proceed to step 2 or 3 without a valid, tested GitHub connection!
   - Step 2 (Board & Column Mapping): Select ProjectV2 board and map status columns to "Done", "In Progress", and "Blocked".
   - Step 3 (First Client Profile): Set client name, email, preferred tone (Formal, Executive, Casual), and language (PT or EN).
   - Step 4 (Completion): Confirm schedule (Friday delivery) and review first generated draft report.
`;

export const OUT_OF_SCOPE_REFUSAL_PT =
  "O meu papel é ajudar-te exclusivamente na configuração do ClientPulse AI, na integração com o GitHub Projects e na resposta a dúvidas sobre o produto. Como posso ajudar com o teu onboarding ou com a tua conta?";

export const OUT_OF_SCOPE_REFUSAL_EN =
  "My role is exclusively to help you set up ClientPulse AI, integrate GitHub Projects, and answer questions about the product. How can I assist you with your onboarding or account?";

/**
 * Validates a GitHub Personal Access Token against GitHub's GraphQL API.
 * Supports demo / mock tokens for offline environments and automated testing.
 */
export async function validateGitHubPat(pat: string): Promise<{
  valid: boolean;
  username: string;
  name?: string;
  error?: string;
}> {
  const cleanPat = pat.trim();

  // Test & demo mock tokens
  if (
    cleanPat.startsWith("github_pat_mock") ||
    cleanPat.startsWith("github_pat_demo") ||
    cleanPat.startsWith("ghp_mock") ||
    cleanPat.startsWith("ghp_demo") ||
    cleanPat.startsWith("demo_pat_")
  ) {
    if (cleanPat.includes("invalid") || cleanPat.includes("expired")) {
      return {
        valid: false,
        username: "",
        error: "Invalid GitHub Personal Access Token (401 Bad Credentials).",
      };
    }
    return {
      valid: true,
      username: "maria-agency",
      name: "Maria Silva",
    };
  }

  // Real GitHub GraphQL API validation
  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanPat}`,
        "Content-Type": "application/json",
        "User-Agent": "ClientPulse-AI/1.0",
      },
      body: JSON.stringify({
        query: `query { viewer { login name } }`,
      }),
    });

    if (response.status === 401) {
      return {
        valid: false,
        username: "",
        error: "Invalid GitHub Personal Access Token (401 Bad Credentials).",
      };
    }

    const json = await response.json();
    if (json.errors && json.errors.length > 0) {
      return {
        valid: false,
        username: "",
        error: json.errors.map((e: { message: string }) => e.message).join(" | "),
      };
    }

    if (json.data?.viewer?.login) {
      return {
        valid: true,
        username: json.data.viewer.login,
        name: json.data.viewer.name ?? json.data.viewer.login,
      };
    }

    return {
      valid: false,
      username: "",
      error: "Could not retrieve user details from GitHub.",
    };
  } catch (err: unknown) {
    return {
      valid: false,
      username: "",
      error: err instanceof Error ? err.message : "Erro ao contactar a API do GitHub.",
    };
  }
}

/**
 * Detects if a message is asking for something completely outside the product scope.
 * (Criterion 4)
 */
export function isOutOfScope(message: string): boolean {
  const lower = message.toLowerCase().trim();

  // Allowed keywords related to product
  const inScopeKeywords = [
    "clientpulse",
    "github",
    "pat",
    "token",
    "onboarding",
    "relatório",
    "relatorio",
    "report",
    "cliente",
    "coluna",
    "mapear",
    "mapeamento",
    "sprint",
    "board",
    "projeto",
    "gemini",
    "ia",
    "ai",
    "portal",
    "zero-login",
    "email",
    "resend",
    "agendamento",
    "faq",
    "bloqueio",
    "proximo passo",
    "próximo passo",
    "trello",
    "notion",
    "jira",
    "login",
    "conta",
    "ajuda",
    "setup",
    "olá",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "quem és",
    "quem es",
    "passo",
    "step",
    "avançar",
    "avanca",
  ];

  const hasInScopeKeyword = inScopeKeywords.some((kw) => lower.includes(kw));

  // Clear out-of-scope triggers
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

  // If message doesn't have any in-scope keywords and is asking something unrelated
  if (!hasInScopeKeyword && lower.length > 15) {
    const genericQuestionTriggers = [
      "quanto é",
      "quanto e",
      "calcula",
      "como resolver",
      "me explica sobre física",
      "me explica sobre quimica",
      "traduz para",
    ];
    if (genericQuestionTriggers.some((t) => lower.includes(t))) return true;
  }

  return false;
}

/**
 * Detects if the user is attempting or asking to advance to next steps (columns, client profile).
 * (Criterion 3)
 */
export function isAdvanceIntent(message: string): boolean {
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
 * Deterministic Documentation FAQ Matcher for offline / fallback scenarios.
 * (Criterion 1 & 2)
 */
export function getDocumentationFaqReply(
  message: string,
  isConnected: boolean,
  username?: string | null
): { reply: string; action: ActionDetected["action"] } | null {
  const lower = message.toLowerCase();

  // FAQ 1: Code privacy / Do you read code?
  if (
    lower.includes("lêem o código") ||
    lower.includes("leem o codigo") ||
    lower.includes("lêem o vosso código") ||
    lower.includes("código-fonte") ||
    lower.includes("codigo-fonte") ||
    lower.includes("privacidade") ||
    lower.includes("repositório") ||
    lower.includes("repositorio")
  ) {
    return {
      reply:
        "Não! Por motivos éticos e de segurança, o ClientPulse AI acede exclusivamente aos metadados do GitHub Projects v2 (títulos das tarefas, colunas, etiquetas e responsáveis). O código-fonte dos teus repositórios nunca é lido, clonado nem armazenado.",
      action: "faq_answered",
    };
  }

  // FAQ 2: Zero-Login Portal / Does client need account/login?
  if (
    lower.includes("login") ||
    lower.includes("conta") ||
    lower.includes("portal") ||
    lower.includes("palavra-passe") ||
    lower.includes("password") ||
    lower.includes("precisa de login") ||
    lower.includes("criar conta")
  ) {
    return {
      reply:
        "O teu cliente não precisa de criar conta nem de fazer login. Cada relatório enviado por e-mail contém uma ligação segura com um token UUIDv4 exclusivo. O Portal do Cliente é uma vista web moderna, simples e só de leitura com o relatório da semana, histórico e gráfico de tarefas por sprint.",
      action: "faq_answered",
    };
  }

  // FAQ 3: AI Hallucinations / Can AI invent tasks?
  if (
    lower.includes("inventar") ||
    lower.includes("alucina") ||
    lower.includes("alucinação") ||
    lower.includes("alucinacao") ||
    lower.includes("precisão") ||
    lower.includes("confiança")
  ) {
    return {
      reply:
        "O nosso motor utiliza o Google Gemini 2.5 Flash com temperatura baixa (0.2) e regras rigorosas anti-alucinação: a IA só sintetiza tarefas que existam de facto no quadro do GitHub. Além disso, o relatório fica em rascunho no dashboard para poderes rever e editar antes de o aprovar.",
      action: "faq_answered",
    };
  }

  // FAQ 4: How scheduling & approval works
  if (
    lower.includes("como funciona o envio") ||
    lower.includes("envio") ||
    lower.includes("agendamento") ||
    lower.includes("aprovação") ||
    lower.includes("aprovacao") ||
    lower.includes("sexta") ||
    lower.includes("bypass")
  ) {
    return {
      reply:
        "Por defeito, o ClientPulse AI compila os relatórios às sextas-feiras. O gestor recebe um aviso no Dashboard para rever o rascunho de 3 blocos e clicar em 'Aprovar e Enviar'. Se preferires automatizar a 100%, podes ativar o modo 'Bypass (Envio Direto)' nas definições do cliente.",
      action: "faq_answered",
    };
  }

  // FAQ 5: Supported tools (Trello, Jira, Notion)
  if (
    lower.includes("trello") ||
    lower.includes("jira") ||
    lower.includes("notion") ||
    lower.includes("clickup") ||
    lower.includes("asana")
  ) {
    return {
      reply:
        "No MVP atual, a única fonte de dados suportada é o GitHub Projects v2. Integrações com Trello, Notion e Jira estão planeadas como evolução futura pós-MVP.",
      action: "faq_answered",
    };
  }

  // Step 2 Guidance: Column mapping
  if (
    lower.includes("colunas") ||
    lower.includes("mapeamento") ||
    lower.includes("mapear") ||
    lower.includes("estados")
  ) {
    if (!isConnected) {
      return {
        reply:
          "Para configurares o mapeamento de colunas, precisamos de validar primeiro a tua ligação ao GitHub. Introduz o teu Personal Access Token (PAT) com a permissão 'read:project'.",
        action: "blocked_requires_pat",
      };
    }
    return {
      reply:
        `Ótimo! Com o GitHub ligado (${username ? `@${username}` : "ativo"}), no Passo 2 associas as colunas do teu GitHub Project aos 3 estados do ClientPulse: 'Concluído' (para 'O que foi feito'), 'Em curso' (para 'Próximos passos') e 'Bloqueado' (para 'Atenção e Bloqueios'). Queres avançar para a criação do cliente?`,
      action: "guide_columns",
    };
  }

  // Step 3 Guidance: Client profile
  if (
    lower.includes("cliente") ||
    lower.includes("perfil") ||
    lower.includes("tom") ||
    lower.includes("idioma")
  ) {
    if (!isConnected) {
      return {
        reply:
          "Antes de criar o perfil do teu primeiro cliente, precisamos de validar a ligação ao GitHub. Por favor, introduz o teu Personal Access Token.",
        action: "blocked_requires_pat",
      };
    }
    return {
      reply:
        "No Passo 3 defines o nome da empresa ou cliente, o e-mail de destino, o idioma (Português de Portugal ou Inglês) e o tom do relatório (Formal, Executivo ou Casual). A IA adapta automaticamente a escrita ao perfil escolhido!",
      action: "guide_client",
    };
  }

  // Guidance: How to create PAT
  if (
    lower.includes("criar pat") ||
    lower.includes("gerar pat") ||
    lower.includes("obter token") ||
    lower.includes("onde crio") ||
    lower.includes("como crio o token")
  ) {
    return {
      reply:
        "Para gerar o teu Personal Access Token no GitHub: vai a GitHub > Settings > Developer Settings > Personal Access Tokens > Fine-grained tokens. Cria um token com permissão de leitura em 'read:project' e 'repo' (leitura de metadados). Depois copia-o e cola-o aqui!",
      action: "awaiting_pat",
    };
  }

  return null;
}

/**
 * Main Controller: Processes an incoming chat message with all criteria enforced.
 */
export async function processOnboardingMessage(
  options: ProcessChatOptions
): Promise<ChatbotResponse> {
  const { message, conversation_history = [], pat_token } = options;
  let isConnected = Boolean(options.is_connected);
  let connectedUsername = options.connected_username ?? null;

  // --------------------------------------------------------------------------
  // Criterion 4: Strict Scope Guardrail Refusal
  // --------------------------------------------------------------------------
  if (isOutOfScope(message)) {
    const isEnglish = /\b(what|how|weather|recipe|joke|capital|write|code|algorithm)\b/i.test(message);
    return {
      reply: isEnglish ? OUT_OF_SCOPE_REFUSAL_EN : OUT_OF_SCOPE_REFUSAL_PT,
      action_detected: {
        action: "out_of_scope_refusal",
        message: "A pergunta encontra-se fora do âmbito do produto.",
      },
      github_status: {
        is_connected: isConnected,
        username: connectedUsername,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Criterion 3 & 2: GitHub PAT Detection and Validation
  // --------------------------------------------------------------------------
  const patRegex = /(github_pat_[a-zA-Z0-9_]{15,}|ghp_[a-zA-Z0-9]{20,}|demo_pat_[a-zA-Z0-9_]+)/i;
  const patMatch = pat_token ? [pat_token] : message.match(patRegex);

  let tokenValidationResult: {
    attempted: boolean;
    success: boolean;
    username?: string;
    error?: string;
  } = { attempted: false, success: false };

  if (patMatch) {
    const candidatePat = patMatch[0].trim();
    tokenValidationResult = { attempted: true, success: false };

    const validation = await validateGitHubPat(candidatePat);
    if (validation.valid) {
      tokenValidationResult = {
        attempted: true,
        success: true,
        username: validation.username,
      };
      isConnected = true;
      connectedUsername = validation.username;
    } else {
      tokenValidationResult = {
        attempted: true,
        success: false,
        error: validation.error,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Criterion 3: Validation gate — Block advancement if GitHub is NOT connected
  // --------------------------------------------------------------------------
  if (!isConnected && isAdvanceIntent(message) && !tokenValidationResult.success) {
    return {
      reply:
        "Para avançar para o mapeamento de colunas e para a criação do primeiro cliente, é obrigatório validar primeiro a ligação ao GitHub. Por favor, introduz o teu Personal Access Token (PAT) com permissão 'read:project' para verificarmos a conexão.",
      action_detected: {
        action: "blocked_requires_pat",
        message: "Ligação ao GitHub obrigatória antes de avançar.",
      },
      github_status: {
        is_connected: false,
        username: null,
      },
    };
  }

  // If PAT was validated successfully on this turn
  if (tokenValidationResult.attempted && tokenValidationResult.success) {
    return {
      reply:
        `Excelente! Validei o teu token com sucesso para o utilizador @${tokenValidationResult.username}. A ligação ao GitHub está confirmada! Agora no Passo 2, vamos mapear as colunas do teu quadro (Done, In Progress, Blocked). Tens alguma dúvida sobre como funciona o mapeamento?`,
      action_detected: {
        action: "pat_validated",
        data: {
          username: tokenValidationResult.username,
          connected: true,
          next_step: 2,
        },
      },
      github_status: {
        is_connected: true,
        username: tokenValidationResult.username ?? null,
      },
    };
  }

  // If PAT was attempted but failed
  if (tokenValidationResult.attempted && !tokenValidationResult.success) {
    return {
      reply:
        `Não consegui validar esse token do GitHub (${tokenValidationResult.error || "credenciais inválidas"}). Verifica se o token tem permissão de leitura em 'read:project' e 'repo' e tenta novamente.`,
      action_detected: {
        action: "pat_failed",
        data: {
          error: tokenValidationResult.error,
        },
      },
      github_status: {
        is_connected: false,
        username: null,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Criterion 1: Documentation FAQ & LLM Generation
  // --------------------------------------------------------------------------
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    "";

  if (apiKey) {
    try {
      const systemInstruction = `
You are PulseBot, the dedicated intelligent onboarding and support assistant for ClientPulse AI.

${PRODUCT_DOCUMENTATION_KNOWLEDGE}

STRICT SCOPE GUARDRAIL (CRITICAL):
- You ONLY answer questions related to ClientPulse AI, onboarding, GitHub Projects integration, reporting, and product FAQs.
- IF THE USER ASKS ANY OUT-OF-SCOPE QUESTION (e.g. coding unrelated algorithms, recipes, sports, weather, creative writing, jokes, personal opinions):
  YOU MUST POLITELY REFUSE WITH:
  "${OUT_OF_SCOPE_REFUSAL_PT}"

STEP ADVANCEMENT GATE (CRITICAL):
- Current GitHub Connection Status: ${isConnected ? `CONNECTED (@${connectedUsername})` : "NOT CONNECTED"}
- If the user asks to advance, skip, or proceed to column mapping or client profile while NOT CONNECTED, YOU MUST REFUSE TO ADVANCE and remind them to connect their GitHub PAT first!

STYLE & TONE:
- Concise, polite, highly professional, welcoming (2 to 4 sentences maximum).
- Speak in Portuguese (PT-PT) by default; if the user speaks in English, answer in English.
`;

      const contents = [];
      const recentHistory = conversation_history.slice(-8);

      for (const h of recentHistory) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        });
      }

      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const model = "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            maxOutputTokens: 350,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (geminiText) {
          return {
            reply: geminiText,
            action_detected: {
              action: isConnected ? "guide_columns" : "awaiting_pat",
              data: { is_connected: isConnected, username: connectedUsername },
            },
            github_status: {
              is_connected: isConnected,
              username: connectedUsername,
            },
          };
        }
      }
    } catch {
      // Fall through to deterministic documentation engine
    }
  }

  // --------------------------------------------------------------------------
  // Deterministic Documentation Engine (Fallback if no API key or offline)
  // --------------------------------------------------------------------------
  const docFaq = getDocumentationFaqReply(message, isConnected, connectedUsername);
  if (docFaq) {
    return {
      reply: docFaq.reply,
      action_detected: {
        action: docFaq.action,
        data: { is_connected: isConnected, username: connectedUsername },
      },
      github_status: {
        is_connected: isConnected,
        username: connectedUsername,
      },
    };
  }

  // Default helpful message
  const defaultReply = isConnected
    ? `A tua ligação ao GitHub está confirmada (@${connectedUsername}). Estamos no Passo 2: mapeamento das colunas do teu board (Done, In Progress, Blocked) ou Passo 3: configuração do perfil do teu cliente. Tens alguma questão?`
    : "Olá! Sou o PulseBot. Para começarmos o setup do ClientPulse AI, introduz o teu Personal Access Token (PAT) do GitHub com a permissão 'read:project'. Se tiveres dúvidas sobre segurança, o portal ou o funcionamento, podes perguntar!";

  return {
    reply: defaultReply,
    action_detected: {
      action: isConnected ? "guide_columns" : "awaiting_pat",
    },
    github_status: {
      is_connected: isConnected,
      username: connectedUsername,
    },
  };
}

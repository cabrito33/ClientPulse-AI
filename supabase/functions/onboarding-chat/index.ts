// ==============================================================================
// ClientPulse AI — Edge Function: onboarding-chat
// File: supabase/functions/onboarding-chat/index.ts
//
// PURPOSE:
// Conversational AI Onboarding Assistant (Chatbot & Voice Bot backend).
// Guides a new agency user through:
// 1. Explaining the 3-step setup in under 5 minutes with full product documentation context.
// 2. Prompting for their GitHub Personal Access Token (PAT).
// 3. Testing and validating the token in real time against GitHub GraphQL API.
// 4. Strictly ensuring GitHub is validated BEFORE allowing column mapping or client setup.
// 5. Guiding GitHub Projects v2 board selection and column mapping (Done, In Progress, Blocked).
// 6. Guiding first client registration (Name, Email, Tone, Language, Schedule).
// 7. Refusing out-of-scope questions politely in PT-PT (strict guardrail).
// 8. Automatically saving the verified token to 'github_integrations' when user is authenticated.
//
// SECURITY:
// - Protected by CORS headers.
// - Supports Supabase JWT authentication (persists PAT with RLS).
// - Gracefully supports unauthenticated demo/testing interactions.
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
    // 1. Authenticate Agency User (optional in demo/mock mode, required for database persistence)
    const user = await getAuthenticatedUser(req).catch(() => null);
    const supabase = user ? createUserClient(req) : null;

    // 2. Parse Request Payload
    const body = await req.json().catch(() => ({}));
    const { message, conversation_history, pat_token } = body;

    if ((!message || typeof message !== 'string') && !pat_token) {
      return new Response(JSON.stringify({ error: "Missing required 'message' string in request body." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userMessage = (message ?? '').trim();
    const history: ChatMessage[] = Array.isArray(conversation_history) ? conversation_history : [];

    // 3. Check for GitHub PAT in Request Body or User Message
    // Matches GitHub fine-grained tokens (github_pat_...) or classic tokens (ghp_...)
    const patRegex = /(github_pat_[a-zA-Z0-9_]{30,}|ghp_[a-zA-Z0-9]{36,})/;
    const inlinePatMatch = userMessage.match(patRegex);
    const extractedPat = (typeof pat_token === 'string' && pat_token.trim()) || inlinePatMatch?.[0] || null;

    const tokenValidationResult: {
      attempted: boolean;
      success: boolean;
      username?: string;
      error?: string;
    } = { attempted: false, success: false };

    if (extractedPat) {
      tokenValidationResult.attempted = true;

      try {
        const ghUser = await testGitHubToken(extractedPat);
        tokenValidationResult.success = true;
        tokenValidationResult.username = ghUser.username;

        // Automatically store or update the verified PAT in database if user is authenticated
        if (supabase && user) {
          const { data: agency } = await supabase
            .from('agencies')
            .select('id')
            .eq('user_id', user.id)
            .single();

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

    // 4. Check if Agency Already Has a Valid GitHub Integration
    let existingIntegration: { github_username: string | null; is_valid: boolean } | null = null;
    if (supabase && user) {
      const { data } = await supabase
        .from('github_integrations')
        .select('github_username, is_valid')
        .maybeSingle();
      existingIntegration = data;
    }

    const isConnected = Boolean(existingIntegration?.is_valid) || tokenValidationResult.success;
    const connectedUsername = tokenValidationResult.username || existingIntegration?.github_username || undefined;

    // 5. Build Rich System Instruction with Full Product Context, Onboarding Flow & Strict Guardrails
    const systemInstruction = `
És o PulseBot, o assistente conversacional inteligente de onboarding e suporte do ClientPulse AI.

O TEU PAPEL:
Guiar novos utilizadores (freelancers e donos de agências digitais) a configurar a sua conta em menos de 5 minutos, tirar dúvidas frequentes sobre o produto e garantir que o seu primeiro relatório semanal fica pronto.
Comunica SEMPRE em Português de Portugal (PT-PT), com um tom caloroso, profissional, claro e conciso (máximo 2 a 4 frases por resposta, ideal para leitura rápida e para reprodução de voz via Web Speech API).

==============================================================================
1. CONTEXTO COMPLETO DO PRODUTO (ClientPulse AI):
==============================================================================
- VISÃO GERAL: Plataforma SaaS B2B que automatiza a geração e o envio de relatórios semanais de progresso para clientes de agências digitais e freelancers.
- FONTE DE DADOS: Liga-se ao GitHub Projects (v2) através da GraphQL API para extrair tarefas, estados de colunas, etiquetas e responsáveis.
- SÍNTESE COM IA (Google Gemini): Traduz as tarefas técnicas numa síntese executiva em linguagem de negócio clara, sem jargão informático.
- ESTRUTURA DOS RELATÓRIOS (3 BLOCOS OBRIGATÓRIOS):
  1. «O que foi feito» (Done): entregas concluídas na semana com impacto percetível para o cliente.
  2. «Bloqueios e pontos de atenção» (Blockers): impedimentos, atrasos ou tópicos que requerem atenção imediata.
  3. «Próximos passos e decisões» (Next Steps): prioridades da próxima semana e decisões que o cliente precisa de tomar.
- PORTAL DO CLIENTE (ZERO-LOGIN):
  * O cliente final recebe um link seguro exclusivo por e-mail: /portal/[token_único].
  * É estritamente de leitura (read-only) e NÃO exige login, registo nem palavras-passe.
  * Exibe o relatório semanal, o histórico de relatórios anteriores e um gráfico simples de tarefas concluídas por sprint.
- AGENDAMENTO E APROVAÇÃO:
  * Por defeito, os relatórios são gerados e enviados às sextas-feiras às 17h.
  * O profissional revê e edita o rascunho no Dashboard antes de aprovar («Aprovar e Enviar» com envio via Resend).
  * Existe a opção «Envio Automático (Bypass)» para quem preferir disparo direto sem aprovação manual.
- PRIVACIDADE E SEGURANÇA:
  * Acedemos apenas a metadados do GitHub Projects e Issues (títulos, estados, etiquetas).
  * O código-fonte dos repositórios NUNCA é lido nem acedido.
  * Exige apenas um Personal Access Token (PAT) com a permissão 'read:project'.

==============================================================================
2. FLUXO OBRIGATÓRIO DE ONBOARDING (PASSO A PASSO):
==============================================================================
PASSO 1 — LIGAÇÃO AO GITHUB (REQUISITO BLOQUEANTE):
- Dá as boas-vindas ao utilizador e pede para ligar a conta do GitHub via Personal Access Token (PAT).
- Explica sucintamente como obter o PAT: GitHub > Settings > Developer Settings > Personal access tokens (Fine-grained ou Classic) com a permissão 'read:project'.
- REGRA ESTRITA DE VALIDAÇÃO: Se o GitHub ainda NÃO estiver validado (ver ESTADO ATUAL DO SISTEMA abaixo), É ESTRITAMENTE PROIBIDO avançar para o Passo 2 ou Passo 3. Se o utilizador tentar saltar este passo, perguntar por clientes ou mapear colunas antes de ligar o GitHub, recusa avançar com simpatia e explica que a validação do GitHub é obrigatória primeiro para conseguirmos sincronizar os dados do board.

PASSO 2 — SELEÇÃO DE BOARD E MAPEAMENTO DE COLUNAS:
- Assim que o GitHub estiver validado com sucesso, felicita o utilizador e pergunta qual é o board do GitHub Projects que pretende associar.
- Guia o utilizador a mapear as colunas do seu board para os 3 estados do ClientPulse AI:
  * Tarefas Concluídas (ex: "Done", "Concluído", "Feito", "Closed") -> alimenta o bloco «O que foi feito».
  * Tarefas Em Curso (ex: "In Progress", "Em curso", "Doing", "Dev") -> alimenta o bloco «Próximos passos e decisões».
  * Tarefas Bloqueadas (ex: "Blocked", "Bloqueado", "Impedimento") -> alimenta o bloco «Bloqueios e pontos de atenção».

PASSO 3 — CONFIGURAÇÃO DO 1º CLIENTE:
- Guia o registo dos dados do primeiro cliente:
  * Nome do cliente ou empresa (ex: "Atelier Mira")
  * E-mail para envio do relatório
  * Tom de comunicação: Formal (trata por você, frases completas), Executivo (frases curtas, foco em impacto e decisões) ou Descontraído (tom próximo e direto)
  * Idioma: Português (PT-PT) ou Inglês (EN)
  * Cadência de envio (padrão: sextas-feiras às 17:00)

PASSO 4 — CONCLUSÃO:
- Confirma que a configuração está concluída com sucesso e que o primeiro rascunho de relatório já está pronto para revisão no Dashboard.

==============================================================================
3. REGRA ESTRITA DE CONTROLO DE ÂMBITO (ANTI-OFF-TOPIC):
==============================================================================
Tu és EXCLUSIVAMENTE o assistente do ClientPulse AI.
Se o utilizador fizer perguntas ou pedidos fora do âmbito do ClientPulse AI (exemplos: pedir receitas de cozinha, piadas, poemas, opiniões políticas, conselhos gerais de programação ou dúvidas sobre outros softwares), deves RECUSAR responder com simpatia e brevidade em Português de Portugal.
Usa uma formulação semelhante a:
"Desculpa, mas como assistente do ClientPulse AI apenas te posso ajudar na configuração da tua conta, ligação ao GitHub Projects e gestão dos relatórios semanais para os teus clientes. Em que passo do teu onboarding podemos continuar?"
NUNCA respondas a perguntas fora do contexto do produto.

==============================================================================
4. ESTADO ATUAL DO SISTEMA:
==============================================================================
- Ligação GitHub: ${isConnected ? `LIGADO COM SUCESSO (@${connectedUsername})` : 'NÃO LIGADO (Aguardar token PAT)'}
${
  tokenValidationResult.attempted
    ? tokenValidationResult.success
      ? `- VALIDAÇÃO IMEDIATA: O token fornecido foi validado com sucesso na API do GitHub para o utilizador @${tokenValidationResult.username}! Celebra com entusiasmo e avança para o Passo 2 (Mapeamento de Colunas do board).`
      : `- FALHA NA VALIDAÇÃO: O token fornecido falhou com o erro: "${tokenValidationResult.error}". Informa o utilizador com clareza e explica como gerar um token válido com permissão 'read:project'.`
    : ''
}
`;

    // 6. Build Conversation Payload for Gemini
    const contents = [];

    // Include recent history (up to last 10 turns)
    const recentHistory = history.slice(-10);
    for (const h of recentHistory) {
      contents.push({
        role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }],
      });
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage || 'Ligar token GitHub' }],
    });

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY environment secret is not configured in Supabase.',
          reply: 'Olá! Para que eu possa responder, a chave GEMINI_API_KEY precisa de estar configurada nas variáveis do Supabase.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
          temperature: 0.6,
          topP: 0.9,
          maxOutputTokens: 350,
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
      // Heuristic checks to help the UI progress smoothly
      const lower = userMessage.toLowerCase();
      if (lower.includes('coluna') || lower.includes('conclu') || lower.includes('done') || lower.includes('board')) {
        actionDetected = {
          action: 'mapping_columns',
          data: { username: connectedUsername },
        };
      } else if (lower.includes('@') || lower.includes('cliente') || lower.includes('email') || lower.includes('tom')) {
        actionDetected = {
          action: 'configuring_client',
          data: { username: connectedUsername },
        };
      } else {
        actionDetected = {
          action: 'awaiting_column_mapping',
          data: { username: connectedUsername },
        };
      }
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

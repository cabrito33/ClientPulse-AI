// ==============================================================================
// ClientPulse AI — Google Gemini AI Synthesis Client
// File: supabase/functions/_shared/gemini.ts
//
// PURPOSE:
// Calls the Google Gemini API (gemini-2.5-flash) to synthesize raw GitHub
// task metadata into a professional 3-block executive summary:
// 1. What was done (Completed)
// 2. Blockers / Attention points (Impediments)
// 3. Next steps (Decisions & upcoming deliverables)
//
// ANTI-HALLUCINATION GUARDRAILS:
// - responseMimeType: "application/json" with strict responseSchema
// - Low temperature (0.2) to prevent creative fabrication
// - Strict system instruction: ONLY synthesize provided task items.
//   Never invent deliverables, timelines, or metrics not in the input.
// ==============================================================================

import type { GitHubTaskItem } from './github.ts';

export interface ReportBlocks {
  done: string;
  blockers: string;
  next_steps: string;
}

export interface GenerateReportOptions {
  clientName: string;
  companyName?: string | null;
  language: 'pt' | 'en';
  tone: 'formal' | 'executive' | 'casual';
  tasks: {
    done: GitHubTaskItem[];
    inProgress: GitHubTaskItem[];
    blocked: GitHubTaskItem[];
  };
  customNotes?: string;
}

/**
 * Builds the strict system prompt tailored to the client's tone and language.
 */
function buildSystemInstruction(language: 'pt' | 'en', tone: 'formal' | 'executive' | 'casual'): string {
  const langText = language === 'pt' ? 'Portuguese (European / Neutral)' : 'English';
  
  const toneDescriptions = {
    formal: 'Polite, traditional, highly professional, using formal grammar and deferential phrasing.',
    executive: 'Clear, concise, high-level business language focusing on value delivered and impact, without unnecessary fluff.',
    casual: 'Friendly, warm, collaborative, and modern, while remaining respectful and clear.',
  };

  return `
You are ClientPulse AI, an expert executive reporting assistant for software development agencies and freelancers.

YOUR MISSION:
Translate raw technical GitHub task items into an executive weekly progress report structured into EXACTLY 3 blocks:
1. 'done': Highlighting what was achieved this week in terms of client value.
2. 'blockers': Attention points, obstacles, or external dependencies requiring client input.
3. 'next_steps': Upcoming priorities and decisions needed for the next sprint.

LANGUAGE & TONE:
- Write strictly in ${langText}.
- Use a ${tone} tone: ${toneDescriptions[tone]}

STRICT ANTI-HALLUCINATION RULES (CRITICAL):
1. ONLY describe work supported directly by the provided task titles, labels, or statuses.
2. NEVER invent features, completed milestones, metrics, or team members that are not in the input data.
3. Translate technical developer jargon (e.g. "fix NPE in authController.ts", "refactor db index") into clear business value (e.g. "Melhoria na estabilidade da autenticação e proteção de sessão", "Otimização da performance da base de dados").
4. If there are NO blocked tasks in the input, explicitly state:
   - PT: "Nenhum impedimento ativo esta semana. Todas as atividades seguem o planeamento previsto."
   - EN: "No active blockers this week. All deliverables are progressing as planned."
5. If there are NO completed tasks in the input, state that the team focused on in-progress deliverables and specify what is currently underway.
6. Format each block with clear bullet points (using '• ') separated by newlines.

EXEMPLOS DE ENTRADA E SAÍDA ESPERADA EM PORTUGUÊS DE PORTUGAL (FEW-SHOT):

--- EXEMPLO 1 (Com tarefas concluídas e impedimento real) ---
Entrada de Tarefas:
- Tarefas Concluídas:
  • "feat: Stripe webhook handler for subscription renewal" (Assignee: Tiago)
  • "fix(auth): session expiration bug on mobile Safari" (Assignee: Sara)
- Tarefas Em Curso:
  • "perf: optimize client dashboard SQL queries" (Assignee: Tiago)
- Tarefas Bloqueadas:
  • "setup staging environment: waiting for AWS credentials from client" (Assignee: Miguel)

Saída JSON esperada:
{
  "done": "• Conclusão da integração de pagamentos e renovação automática de subscrições com tratamento seguro via Stripe.\\n• Resolução do problema de expiração de sessão em dispositivos móveis, assegurando uma navegação estável e sem interrupções.",
  "blockers": "• A configuração do ambiente de testes (staging) aguarda a disponibilização das credenciais da infraestrutura AWS por parte da equipa do cliente.",
  "next_steps": "• Finalização da otimização das consultas à base de dados para acelerar o carregamento dos indicadores no dashboard executivo."
}

--- EXEMPLO 2 (Sem tarefas bloqueadas — aplicação estrita da regra de impedimentos) ---
Entrada de Tarefas:
- Tarefas Concluídas:
  • "feat: export executive reports to PDF and Excel format" (Assignee: Beatriz)
- Tarefas Em Curso:
  • "refactor: email notification templates and retry queue" (Assignee: Diogo)
- Tarefas Bloqueadas: nenhumas

Saída JSON esperada:
{
  "done": "• Disponibilização da funcionalidade de exportação de relatórios executivos em formatos PDF e Excel para partilha com as equipas de gestão.",
  "blockers": "• Nenhum impedimento ativo esta semana. Todas as atividades seguem o planeamento previsto.",
  "next_steps": "• Conclusão da modernização dos modelos de notificação por e-mail e implementação do mecanismo de reenvio automático em caso de falha de rede."
}
`;
}

/**
 * Calls the Google Gemini API to generate the structured 3-block report.
 */
export async function generateExecutiveReport(
  apiKey: string,
  options: GenerateReportOptions
): Promise<ReportBlocks> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase environment secrets.');
  }

  // Primary model: gemini-2.5-flash (fast, high precision, cost-free in AI Studio)
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = buildSystemInstruction(options.language, options.tone);

  // Prepare input payload summary for the prompt
  const promptData = {
    client_name: options.clientName,
    company: options.companyName ?? 'N/A',
    custom_manager_notes: options.customNotes ?? 'None',
    tasks_summary: {
      completed_tasks: options.tasks.done.map((t) => ({
        title: t.title,
        assignee: t.assignee,
        labels: t.labels,
      })),
      in_progress_tasks: options.tasks.inProgress.map((t) => ({
        title: t.title,
        assignee: t.assignee,
        labels: t.labels,
      })),
      blocked_tasks: options.tasks.blocked.map((t) => ({
        title: t.title,
        assignee: t.assignee,
        labels: t.labels,
      })),
    },
  };

  const userPrompt = `
Generate the weekly executive report based on this project data:
${JSON.stringify(promptData, null, 2)}
`;

  // Request payload with strict JSON schema
  const requestBody = {
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2, // Low temperature for high factual accuracy
      topP: 0.8,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          done: {
            type: 'STRING',
            description: 'Bullet points detailing completed deliverables in clear business language.',
          },
          blockers: {
            type: 'STRING',
            description: 'Bullet points detailing blockers, delays, or attention items requiring client awareness.',
          },
          next_steps: {
            type: 'STRING',
            description: 'Bullet points detailing upcoming priorities and decisions for the upcoming week.',
          },
        },
        required: ['done', 'blockers', 'next_steps'],
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (HTTP ${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini API returned an empty response.');
  }

  try {
    const parsed: ReportBlocks = JSON.parse(rawText);
    
    // Validate that all 3 mandatory blocks exist
    if (!parsed.done || !parsed.blockers || !parsed.next_steps) {
      throw new Error('Gemini output missing one of the 3 required blocks (done, blockers, next_steps).');
    }

    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse Gemini structured JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

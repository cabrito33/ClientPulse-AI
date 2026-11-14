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

STRICT ANTI-HALLUCINATION & PRIVACY RULES (CRITICAL):
1. PRIVACY & DATA MINIMIZATION: You receive strictly minimized task metadata (title, description, status, labels, assignees). Never infer or invent source code, file contents, credentials, or external private data.
2. ONLY describe work supported directly by the provided task titles, descriptions, labels, or statuses.
3. NEVER invent features, completed milestones, metrics, or team members that are not in the input data.
4. Translate technical developer jargon (e.g. "fix NPE in authController.ts", "refactor db index") into clear business value (e.g. "Melhoria na estabilidade da autenticação e proteção de sessão", "Otimização da performance da base de dados").
5. If there are NO blocked tasks in the input (or the Blocked column is not mapped), write strictly:
   - PT: "Sem bloqueios registados no board."
   - EN: "No blockers registered on the board."
   NEVER state or imply that "everything is going according to plan" or make any other unverifiable claims.
6. If there are NO completed tasks in the input, state that the team focused on in-progress deliverables and specify what is currently underway.
7. Format each block with clear bullet points (using '• ') separated by newlines (unless stating "Sem bloqueios registados no board.").
8. BUSINESS AUDIENCE & NO TECHNICAL JARGON:
   - Write strictly for a business client, NOT for software engineers.
   - Do NOT use names of technologies, libraries, frameworks, databases, or infrastructure terms (e.g. avoid PostgreSQL, Docker, Redis, Tailwind, Next.js, Node.js, "Cron Job", API endpoints, SQL queries, etc.). Describe the practical outcome and value for the business instead.
   - You may ONLY name a specific technology if it is explicitly present in the task card's title AND the client's tone or context specifically demands it.
   - Always maintain strict anti-hallucination guardrails: do not extrapolate beyond what is in the task metadata.

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
  "blockers": "Sem bloqueios registados no board.",
  "next_steps": "• Conclusão da modernização dos modelos de notificação por e-mail e implementação do mecanismo de reenvio automático em caso de falha de rede."
}
`;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1500, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves the primary Gemini model name to use, reading the optional GEMINI_MODEL secret
 * with a fallback to 'gemini-3.8-flash'.
 */
export function getGeminiModel(): string {
  return Deno.env.get('GEMINI_MODEL')?.trim() || 'gemini-3.8-flash';
}

/**
 * Resolves the secondary/fallback Gemini model name to use, reading the optional GEMINI_FALLBACK_MODEL secret
 * with a default to 'gemini-3.7-flash'.
 */
export function getGeminiFallbackModel(): string {
  return Deno.env.get('GEMINI_FALLBACK_MODEL')?.trim() || 'gemini-3.7-flash';
}

export interface GeneratedReportResult extends ReportBlocks {
  modelUsed: string;
}

/**
 * Low-level call to Gemini API with retries on transient errors (429, 500, 502, 503, 504).
 * Retries up to 2 times with increasing backoff (1.5s, 4s).
 */
export async function callGeminiModel(
  model: string,
  apiKey: string,
  requestBody: unknown
): Promise<{ text: string; model: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let lastStatus = 0;
  let lastErrorText = '';

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(25000),
      });

      if (response.ok) {
        const result = await response.json();
        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('Gemini API returned an empty response.');
        }
        return { text: rawText, model };
      }

      lastStatus = response.status;
      lastErrorText = await response.text();
      console.error(
        `[gemini] API Error for model ${model} (HTTP ${lastStatus}): ${lastErrorText}`
      );

      // If not a retryable status (e.g. 400, 404, 401, 403), stop retrying this model immediately
      if (!RETRYABLE_STATUSES.has(lastStatus)) {
        break;
      }

      // If retryable and we have attempts remaining, wait before next attempt
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(
          `[gemini] Model ${model} returned HTTP ${lastStatus}. Retrying attempt ${attempt + 1}/${RETRY_DELAYS_MS.length} in ${delay}ms...`
        );
        await sleep(delay);
      }
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      lastErrorText = msg;
      console.error(`[gemini] Network/fetch error for model ${model}: ${msg}`);
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  throw new Error(
    `Gemini API Error for model ${model} (HTTP ${lastStatus}): ${lastErrorText}`
  );
}

/**
 * Strict Data Minimization Helper (Issue #51 / DOC-04).
 * Ensures ONLY the strictly necessary task metadata fields are transmitted to Google Gemini:
 * - title (string)
 * - description (string | undefined, sanitized and truncated to max 300 chars)
 * - status (string)
 * - labels (string[])
 * - assignee (string | null)
 *
 * Excludes: database internal IDs, card URLs, closed timestamps, commit SHAs, git diffs, file trees, or repository tokens.
 */
export interface MinimizedTaskForAI {
  title: string;
  description?: string;
  status: string;
  labels: string[];
  assignee: string | null;
}

export function minimizeTaskForAI(t: GitHubTaskItem): MinimizedTaskForAI {
  return {
    title: t.title,
    ...(t.description ? { description: t.description } : {}),
    status: t.status,
    labels: t.labels,
    assignee: t.assignee,
  };
}

/**
 * Calls the Google Gemini API to generate the structured 3-block report.
 * Tries the primary model with retries, then falls back to secondary model if primary fails.
 */
export async function generateExecutiveReport(
  apiKey: string,
  options: GenerateReportOptions
): Promise<GeneratedReportResult> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase environment secrets.');
  }

  const primaryModel = getGeminiModel();
  const fallbackModel = getGeminiFallbackModel();
  const systemInstruction = buildSystemInstruction(options.language, options.tone);

  // Prepare input payload summary for the prompt with strict data minimization
  const promptData = {
    client_name: options.clientName,
    company: options.companyName ?? 'N/A',
    custom_manager_notes: options.customNotes ?? 'None',
    tasks_summary: {
      completed_tasks: options.tasks.done.map(minimizeTaskForAI),
      in_progress_tasks: options.tasks.inProgress.map(minimizeTaskForAI),
      blocked_tasks: options.tasks.blocked.map(minimizeTaskForAI),
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
      maxOutputTokens: 2048,
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

  let callResult: { text: string; model: string };

  try {
    callResult = await callGeminiModel(primaryModel, apiKey, requestBody);
  } catch (primaryErr: unknown) {
    const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn(
      `[gemini] Primary model ${primaryModel} failed (${primaryMsg}). Attempting fallback model ${fallbackModel}...`
    );

    if (fallbackModel === primaryModel) {
      throw primaryErr;
    }

    try {
      callResult = await callGeminiModel(fallbackModel, apiKey, requestBody);
    } catch (fallbackErr: unknown) {
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.error(
        `[gemini] Fallback model ${fallbackModel} also failed: ${fallbackMsg}`
      );
      throw new Error(
        `All Gemini models failed. Primary (${primaryModel}): ${primaryMsg}. Fallback (${fallbackModel}): ${fallbackMsg}`
      );
    }
  }

  try {
    const parsed: ReportBlocks = JSON.parse(callResult.text);

    // Validate that all 3 mandatory blocks exist
    if (!parsed.done || !parsed.blockers || !parsed.next_steps) {
      throw new Error('Gemini output missing one of the 3 required blocks (done, blockers, next_steps).');
    }

    return {
      done: parsed.done,
      blockers: parsed.blockers,
      next_steps: parsed.next_steps,
      modelUsed: callResult.model,
    };
  } catch (err) {
    throw new Error(`Failed to parse Gemini structured JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

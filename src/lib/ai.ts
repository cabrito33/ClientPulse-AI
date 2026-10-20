/**
 * Extension point: AI report generation.
 *
 * The prototype never calls a model — it returns the stored demo draft.
 * In production this module calls OpenAI/Gemini with a strict prompt that
 * only sees task metadata (title, status, labels, assignees) and never
 * repository source code. See docs/DECISIONS.md (D-004).
 */
import type { Client, ReportSection } from "@/data/types";

export interface GenerationInput {
  client: Client;
  sprintLabel: string;
  tasks: { title: string; status: "done" | "in_progress" | "blocked"; labels?: string[] }[];
  /** Hard rule from the PRD: only metadata, never file contents. */
  metadataOnly: true;
}

export interface GenerationResult {
  intro: string;
  sections: ReportSection;
  model: string;
  tokensUsed: number;
}

const TONE_HINT: Record<Client["tone"], string> = {
  formal: "Trate por «você», frases completas, sem exclamações.",
  executivo: "Priorize decisões e impacto de negócio em frases curtas.",
  descontraido: "Tom próximo e direto, sem perder o profissionalismo.",
};

export function buildPrompt(input: GenerationInput): string {
  return [
    "És um consultor que escreve relatórios semanais para clientes não técnicos.",
    `Idioma: ${input.client.language === "pt" ? "Português de Portugal" : "Inglês"}.`,
    `Tom: ${input.client.tone}. ${TONE_HINT[input.client.tone]}`,
    "Estrutura obrigatória: O que foi feito / Bloqueios e pontos de atenção / Próximos passos.",
    "Não inventes tarefas. Não menciones código-fonte, branches, commits ou nomes de ficheiros.",
    `Tarefas: ${JSON.stringify(input.tasks)}`,
  ].join("\n");
}

/**
 * Placeholder generator. Returns the demo draft untouched so the UI keeps
 * working; swap for a real API call when the key is configured.
 */
export async function generateReportDraft(
  input: GenerationInput,
  fallback: GenerationResult,
): Promise<GenerationResult> {
  if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return fallback;
  }
  // TODO(fase 2): call the provider with buildPrompt(input), validate the
  // JSON schema of the three sections, then return GenerationResult.
  void buildPrompt(input);
  return fallback;
}

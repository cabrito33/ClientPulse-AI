/**
 * ClientPulse AI — Centralized Supabase Edge Functions Client.
 *
 * All calls from the Next.js server (Server Actions, Route Handlers) to Edge Functions
 * MUST pass through this module.
 *
 * Rules:
 * - Uses the authenticated user's session JWT (`Authorization: Bearer <token>`).
 * - Sends `apikey: NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 * - NEVER uses or exposes `SUPABASE_SERVICE_ROLE_KEY`.
 * - Handles base URLs, JSON serialization, and uniform error formatting in PT-PT.
 * - Supports `NEXT_PUBLIC_USE_MOCK=true` fallback.
 */

import { createClient } from "@/lib/supabase/server";

export interface EdgeFunctionError {
  error: string;
  statusCode?: number;
}

/**
 * Invokes a Supabase Edge Function from the server context using the current user's session.
 */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body?: unknown,
  options?: {
    timeoutMs?: number;
  },
): Promise<T> {
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isMock || !supabaseUrl || !anonKey) {
    return handleMockEdgeInvocation<T>(functionName, body);
  }

  // 1. Resolve current user's JWT from Supabase Auth session
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const jwt = session?.access_token;
  if (!jwt) {
    throw new Error("Sessão expirada ou utilizador não autenticado. Por favor, faz login novamente.");
  }

  // 2. Build Edge Function URL
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const functionUrl = `${baseUrl}/functions/v1/${functionName}`;

  // 3. Setup timeout controller
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 60000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
        apikey: anonKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get("content-type") || "";
    let data: Record<string, unknown> | null = null;
    if (contentType.includes("application/json")) {
      data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    } else {
      const text = await res.text().catch(() => "");
      data = { message: text };
    }

    if (!res.ok) {
      const rawError = String(data?.error || data?.message || `Erro ${res.status}`);
      throw new Error(translateEdgeError(rawError));
    }

    return data as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error(
          `O serviço demorou demasiado tempo a responder (${Math.round(timeoutMs / 1000)}s). Por favor, tenta novamente.`,
        );
      }
      throw err;
    }
    throw new Error("Ocorreu um erro inesperado ao comunicar com o servidor.");
  }
}

/**
 * Translates common backend English error messages into friendly Portuguese (PT-PT).
 */
function translateEdgeError(msg: string): string {
  if (!msg) return "Erro desconhecido ao processar o pedido.";

  const lower = msg.toLowerCase();
  if (lower.includes("unauthorized") || lower.includes("missing or invalid authentication")) {
    return "Não autorizado. Por favor, inicia sessão novamente.";
  }
  if (lower.includes("not found")) {
    return "Registo não encontrado ou sem permissão de acesso.";
  }
  if (lower.includes("pat") && (lower.includes("not configured") || lower.includes("not found"))) {
    return "Token de acesso do GitHub (PAT) não configurado. Por favor, liga a tua conta GitHub primeiro.";
  }
  if (lower.includes("bad credentials") || lower.includes("401")) {
    return "Credenciais do GitHub inválidas ou token expirado. Por favor, reintroduz o teu PAT.";
  }
  if (lower.includes("rate limit")) {
    return "Limite de pedidos à API do GitHub atingido. Tenta novamente mais tarde.";
  }
  if (lower.includes("gemini") || lower.includes("ai")) {
    return "O assistente de inteligência artificial encontrou uma dificuldade temporária. O rascunho pode ser revisto manualmente.";
  }
  if (lower.includes("resend") || lower.includes("email")) {
    return "Falha no serviço de entrega de e-mail (Resend). Verifica se o endereço do cliente é válido.";
  }

  return msg;
}

/**
 * Fallback mock handler when NEXT_PUBLIC_USE_MOCK=true.
 */
function handleMockEdgeInvocation<T>(functionName: string, body: unknown): T {
  console.warn(`[edge] Executando em modo Mock para '${functionName}'`);

  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (functionName === "approve-and-send") {
    return {
      success: true,
      report_id: (payload.report_id as string) ?? "rpt-mock",
      status: "sent",
      sent_at: new Date().toISOString(),
      email_delivery_id: "re_mock_12345",
      is_mock_delivery: true,
      mock: true,
      portal_url: "http://localhost:3000/portal?token=demo-token",
    } as T;
  }

  if (functionName === "generate-report") {
    return {
      success: true,
      report_id: "rpt-generated-mock",
      client_id: (payload.client_id as string) ?? "client-mock",
      status: "draft",
      period: {
        start: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
        end: new Date().toISOString().split("T")[0],
      },
    } as T;
  }

  if (functionName === "github-sync") {
    const action = (payload as { action?: string }).action;
    if (action === "list-projects") {
      return {
        owner: (payload as { owner?: string }).owner || "demo-agency",
        owner_type: "user",
        projects: [
          {
            id: "PVT_proj_1",
            number: 1,
            title: "Website 2026 — Atelier Mira",
            closed: false,
            url: "https://github.com/users/demo/projects/1",
          },
          {
            id: "PVT_proj_2",
            number: 2,
            title: "Portal do Paciente — Fase 2",
            closed: false,
            url: "https://github.com/users/demo/projects/2",
          },
        ],
      } as T;
    }
    if (action === "fetch-columns") {
      return {
        projectId: (payload as { project_id?: string }).project_id || "PVT_proj_1",
        projectTitle: "Website 2026 — Atelier Mira",
        columns: [
          { id: "c1", name: "Backlog", color: "GRAY" },
          { id: "c2", name: "Em curso", color: "YELLOW" },
          { id: "c3", name: "Bloqueado", color: "RED" },
          { id: "c4", name: "Concluído", color: "GREEN" },
        ],
      } as T;
    }
    return {
      success: true,
      projects: [],
      columns: ["Backlog", "Em curso", "Bloqueado", "Concluído"],
    } as T;
  }

  if (functionName === "onboarding-chat") {
    const msg = (payload.message as string) || "";
    const hasPat = /(github_pat_[a-zA-Z0-9_]{30,}|ghp_[a-zA-Z0-9]{36,})/.test(msg);
    return {
      reply: hasPat
        ? "Excelente! O teu token GitHub foi validado com sucesso. Podes agora selecionar o teu board abaixo para avançar."
        : "Olá! Posso ajudar-te com qualquer dúvida sobre a configuração ou podes introduzir o teu Personal Access Token (PAT) do GitHub.",
      action_detected: hasPat
        ? { action: "pat_validated", data: { username: "demo-user", connected: true } }
        : { action: "awaiting_pat" },
      github_status: {
        is_connected: hasPat,
        username: hasPat ? "demo-user" : null,
      },
    } as T;
  }

  return { success: true } as T;
}

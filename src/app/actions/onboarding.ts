"use server";

import { invokeEdgeFunction } from "@/lib/edge";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface OnboardingChatResponse {
  reply: string;
  action_detected?: {
    action: string;
    data?: Record<string, unknown>;
  } | null;
  github_status?: {
    is_connected: boolean;
    username: string | null;
  };
}

export interface GitHubProjectSummary {
  id: string;
  number: number;
  title: string;
  closed: boolean;
  url: string;
}

/**
 * Server action to send a user message and conversation history to the onboarding-chat Edge Function.
 */
export async function sendOnboardingMessageAction(
  message: string,
  conversationHistory: OnboardingChatMessage[],
  context?: {
    current_step?: number;
    selected_project?: string;
  }
): Promise<
  | { success: true; data: OnboardingChatResponse }
  | { success: false; error: string }
> {
  try {
    const res = await invokeEdgeFunction<OnboardingChatResponse>(
      "onboarding-chat",
      {
        message,
        conversation_history: conversationHistory,
        current_step: context?.current_step,
        selected_project: context?.selected_project,
      }
    );
    return { success: true, data: res };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Erro ao comunicar com o assistente.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Server action to list Projects v2 from the connected GitHub account.
 */
export async function listGitHubProjectsAction(
  owner?: string,
  ownerType?: "user" | "organization"
): Promise<
  | { success: true; projects: GitHubProjectSummary[]; owner: string }
  | { success: false; error: string }
> {
  try {
    const res = await invokeEdgeFunction<{
      owner: string;
      owner_type: string;
      projects: GitHubProjectSummary[];
    }>("github-sync", {
      action: "list-projects",
      owner: owner || undefined,
      owner_type: ownerType || "user",
    });
    return {
      success: true,
      projects: res.projects || [],
      owner: res.owner || "",
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Erro ao listar projetos do GitHub.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Server action to fetch columns (status options) from a GitHub Project v2.
 */
export async function fetchProjectColumnsAction(
  projectId: string
): Promise<
  | { success: true; columns: string[]; projectTitle?: string }
  | { success: false; error: string }
> {
  try {
    const res = await invokeEdgeFunction<{
      projectId?: string;
      projectTitle?: string;
      columns?: Array<{ id?: string; name?: string; color?: string } | string>;
    }>("github-sync", {
      action: "fetch-columns",
      project_id: projectId,
    });
    const rawCols = res?.columns || [];
    const columns: string[] = rawCols
      .map((c) => (typeof c === "string" ? c : c?.name || ""))
      .filter((c) => Boolean(c));
    return {
      success: true,
      columns:
        columns.length > 0
          ? columns
          : ["A Fazer", "Em Curso", "Bloqueado", "Concluído"],
      projectTitle: res?.projectTitle,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Erro ao obter colunas do projeto.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Server action to check if the current agency already has a valid GitHub connection.
 */
export async function checkGitHubIntegrationStatusAction(): Promise<{
  isConnected: boolean;
  username: string | null;
}> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("github_integrations") as any)
      .select("github_username, is_valid")
      .maybeSingle();

    if (data?.is_valid) {
      return { isConnected: true, username: (data.github_username as string) ?? null };
    }
    return { isConnected: false, username: null };
  } catch {
    return { isConnected: false, username: null };
  }
}

export interface CompleteOnboardingInput {
  clientName: string;
  clientEmail: string;
  projectId: string;
  projectOwner: string;
  tone: "formal" | "executivo" | "descontraido";
  language: "pt" | "en";
  columnMapping: {
    done: string;
    in_progress: string;
    blocked: string;
  };
}

/**
 * Server action to create a new client in the database from onboarding,
 * save column mapping, and trigger the first draft generation.
 */
export async function completeOnboardingAction(
  input: CompleteOnboardingInput
): Promise<
  | { success: true; clientId: string; reportId: string | null }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Sessão expirada. Inicie sessão novamente." };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: agency } = await (supabase.from("agencies") as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agency) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newAgency, error: createAgencyErr } = await (supabase.from("agencies") as any)
        .insert({
          user_id: user.id,
          name:
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "A Minha Agência",
        })
        .select("id")
        .single();

      if (createAgencyErr || !newAgency) {
        return {
          success: false,
          error: createAgencyErr?.message || "Não foi possível criar a agência.",
        };
      }
      agency = newAgency;
    }

    const agencyId = agency.id as string;
    const toneMap: Record<string, "formal" | "executive" | "casual"> = {
      formal: "formal",
      executivo: "executive",
      descontraido: "casual",
    };
    const dbTone = toneMap[input.tone] || "executive";

    // Check if client with this email already exists for this agency to avoid duplicate errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingClient } = await (supabase.from("clients") as any)
      .select("id")
      .eq("agency_id", agencyId)
      .eq("email", input.clientEmail)
      .maybeSingle();

    let clientId: string;

    if (existingClient?.id) {
      clientId = existingClient.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("clients") as any)
        .update({
          name: input.clientName,
          company_name: input.clientName,
          communication_tone: dbTone,
          language: input.language,
          github_project_id: input.projectId,
          github_project_owner: input.projectOwner || "default",
          column_mapping: {
            done: [input.columnMapping.done],
            in_progress: [input.columnMapping.in_progress],
            blocked: [input.columnMapping.blocked],
          },
        })
        .eq("id", clientId);

      // Ensure active portal token record with 90-day expiration (BE-19)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedClient } = await (supabase.from("clients") as any)
        .select("portal_token")
        .eq("id", clientId)
        .single();
      if (updatedClient?.portal_token) {
        const expirationDays = parseInt(process.env.PORTAL_TOKEN_EXPIRATION_DAYS || "90", 10) || 90;
        const expiresAt = new Date(Date.now() + expirationDays * 86400000).toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("portal_tokens") as any).upsert(
          {
            client_id: clientId,
            agency_id: agencyId,
            token: updatedClient.portal_token,
            is_active: true,
            expires_at: expiresAt,
            revoked_at: null,
          },
          { onConflict: "token" }
        );
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newClient, error: clientErr } = await (supabase.from("clients") as any)
        .insert({
          agency_id: agencyId,
          name: input.clientName,
          email: input.clientEmail,
          company_name: input.clientName,
          communication_tone: dbTone,
          language: input.language,
          github_project_id: input.projectId,
          github_project_owner: input.projectOwner || "default",
          github_project_type: "user",
          column_mapping: {
            done: [input.columnMapping.done],
            in_progress: [input.columnMapping.in_progress],
            blocked: [input.columnMapping.blocked],
          },
          auto_send_enabled: false,
        })
        .select("id, portal_token")
        .single();

      if (clientErr || !newClient) {
        return {
          success: false,
          error: clientErr?.message || "Erro ao criar cliente.",
        };
      }
      clientId = newClient.id as string;

      // Ensure active portal token record with 90-day expiration (BE-19)
      if (newClient.portal_token) {
        const expirationDays = parseInt(process.env.PORTAL_TOKEN_EXPIRATION_DAYS || "90", 10) || 90;
        const expiresAt = new Date(Date.now() + expirationDays * 86400000).toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("portal_tokens") as any).upsert(
          {
            client_id: clientId,
            agency_id: agencyId,
            token: newClient.portal_token,
            is_active: true,
            expires_at: expiresAt,
            revoked_at: null,
          },
          { onConflict: "token" }
        );
      }
    }

    let generatedReportId: string | null = null;
    try {
      const res = await invokeEdgeFunction<{ report_id?: string }>(
        "generate-report",
        {
          client_id: clientId,
          period_days: 7,
        },
        {
          timeoutMs: 90000,
        }
      );
      if (res?.report_id) {
        generatedReportId = res.report_id;
      }
    } catch (genErr) {
      console.warn("Aviso ao gerar primeiro relatório:", genErr);
    }

    return {
      success: true,
      clientId,
      reportId: generatedReportId,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Erro ao concluir configuração.";
    return { success: false, error: errorMsg };
  }
}

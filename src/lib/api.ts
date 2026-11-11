/**
 * Data access layer — Supabase edition.
 *
 * All UI code imports from this file only. Signatures are identical to the
 * previous mock implementation so no page or component needs to change.
 *
 * Column mapping (DB snake_case → frontend camelCase) is handled inside each
 * function. Pure-utility helpers (parseBodyToSections, parseBodyToSections) are
 * still exported because components import them directly.
 *
 * Issue: [BE-03] Migrar src/lib/api.ts do mock em memória para Supabase JS Client
 */

import { createClient } from "@/lib/supabase/server";
import { invokeEdgeFunction } from "@/lib/edge";
import type { Tables } from "@/types/database.types";
import type {
  Client,
  DashboardSummary,
  Report,
  ReportSection,
  SprintMetric,
} from "@/data/types";
import type { SprintCard } from "@/data/metrics";

/* ------------------------------------------------------------------ */
/*  Error helpers                                                       */
/* ------------------------------------------------------------------ */

/** Wraps every Supabase response — throws a typed error on failure. */
function assertOk<T>(
  result: { data: T | null; error: { message: string } | null },
  context: string,
): T {
  if (result.error) {
    throw new Error(`[api] ${context}: ${result.error.message}`);
  }
  return result.data as T;
}

/* ------------------------------------------------------------------ */
/*  Validation helpers                                                 */
/* ------------------------------------------------------------------ */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/* ------------------------------------------------------------------ */
/*  Row → Domain mappers                                               */
/* ------------------------------------------------------------------ */

type ClientRow = Tables<"clients">;
type ReportRow = Tables<"reports">;
type SprintMetricRow = Tables<"sprint_metrics">;
type ReportTaskRow = Tables<"report_tasks">;

/**
 * Maps a Supabase `clients` row to the frontend `Client` type.
 *
 * Fields that exist in the DB but have no direct UI equivalent are
 * derived or given sensible defaults so pages never break.
 */
function mapClient(row: ClientRow): Client {
  // Derive tone: DB stores free-text; map known values, default "formal".
  const toneMap: Record<string, Client["tone"]> = {
    formal: "formal",
    executivo: "executivo",
    descontraido: "descontraido",
  };
  const tone: Client["tone"] =
    toneMap[row.communication_tone] ?? "formal";

  // Derive frequency from schedule_day_of_week (0 = every week = weekly).
  // Convention: schedule_day_of_week = -1 means biweekly, -2 monthly.
  // Fall back to "weekly" for all positive DOW values.
  const frequency: Client["frequency"] =
    row.schedule_day_of_week === -1
      ? "biweekly"
      : row.schedule_day_of_week === -2
        ? "monthly"
        : "weekly";

  // Convert numeric DOW → Portuguese day name used by the UI.
  const dowNames = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  const sendDay =
    row.schedule_day_of_week >= 0
      ? (dowNames[row.schedule_day_of_week] ?? "Sexta-feira")
      : "Sexta-feira";

  // Convert UTC hour → "HH:00" string in UTC (UI shows UTC for now).
  const sendTime = `${String(row.schedule_hour_utc).padStart(2, "0")}:00`;

  // Derive avatar initials from name (first letters of first two words).
  const initials = row.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return {
    id: row.id,
    name: row.name,
    company: row.company_name ?? row.name,
    email: row.email,
    language: row.language,
    tone,
    frequency,
    sendDay,
    sendTime,
    autoSend: row.auto_send_enabled,
    // DB doesn't have a client status column; default to "active".
    status: "active",
    portalToken: row.portal_token,
    // projectName: combine owner/project — displayed in portal header.
    projectName: `${row.github_project_owner}/${row.github_project_id}`,
    avatarInitials: initials,
    startedAt: row.created_at.slice(0, 10),
  };
}

/**
 * Maps a Supabase `reports` row to the frontend `Report` type.
 *
 * The DB stores three text columns (summary_done, summary_blockers,
 * summary_next_steps) while the UI expects a structured `sections` object
 * and a rendered `body` string. We reconstruct both here.
 */
function mapReport(row: ReportRow, customErrorMessage?: string | null): Report {
  // Parse the three summary columns into the structured section shape.
  const sections: ReportSection = {
    done: splitLines(row.summary_done),
    blocks: splitLines(row.summary_blockers),
    next: splitLines(row.summary_next_steps),
  };

  // Render a markdown body the editor can round-trip.
  const body = buildBody(sections);

  // Derive a week label from the period dates.
  const weekLabel = buildWeekLabel(row.period_start, row.period_end);

  // Count tasks from embedded raw_github_data if available.
  const { tasksCompleted, tasksPlanned } = extractTaskCounts(
    row.raw_github_data,
  );

  // Map DB status to UI status.
  const statusMap: Record<
    ReportRow["status"],
    Report["status"]
  > = {
    draft: "draft",
    approved: "pending_approval",
    sent: "sent",
    failed: "failed",
  };

  const status = statusMap[row.status] ?? "draft";
  const rawObj =
    row.raw_github_data &&
    typeof row.raw_github_data === "object" &&
    !Array.isArray(row.raw_github_data)
      ? (row.raw_github_data as Record<string, unknown>)
      : null;
  const generatedWithoutAi = Boolean(rawObj?.generated_without_ai);

  const errorMessage =
    customErrorMessage !== undefined
      ? customErrorMessage
      : status === "failed"
        ? extractErrorMessage(row)
        : generatedWithoutAi && rawObj?.ai_error
          ? String(rawObj.ai_error)
          : null;

  return {
    id: row.id,
    clientId: row.client_id,
    weekLabel,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status,
    subject: `Relatório — ${weekLabel}`,
    intro: "",
    sections,
    body,
    tasksCompleted,
    tasksPlanned,
    generatedAt: row.created_at,
    sentAt: row.sent_at ?? null,
    openedAt: null, // delivery tracking not yet in schema
    errorMessage,
    generatedWithoutAi,
  };
}

/** Extracts an error message for failed reports from raw_github_data or defaults. */
function extractErrorMessage(row: ReportRow): string {
  if (
    row.raw_github_data &&
    typeof row.raw_github_data === "object" &&
    !Array.isArray(row.raw_github_data)
  ) {
    const raw = row.raw_github_data as Record<string, unknown>;
    if (typeof raw.error === "string") return raw.error;
    if (typeof raw.error_message === "string") return raw.error_message;
    if (typeof raw.message === "string") return raw.message;
  }
  return "Falha na entrega de e-mail ao destinatário (serviço Resend).";
}

function mapSprintMetric(row: SprintMetricRow): SprintMetric {
  return {
    sprint: row.sprint,
    label: row.label,
    completed: row.completed,
    planned: row.planned,
  };
}

function mapReportTask(row: ReportTaskRow): SprintCard {
  const columnMap: Record<
    ReportTaskRow["status_category"],
    SprintCard["column"]
  > = {
    done: "done",
    in_progress: "in_progress",
    blocked: "blocked",
  };
  return {
    id: row.github_item_id,
    title: row.title,
    column: columnMap[row.status_category],
    clientId: row.client_id,
    label: row.labels?.[0] ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                     */
/* ------------------------------------------------------------------ */

/** Splits a newline-delimited summary string into an array of items. */
function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

/** Renders the structured sections into the editable markdown body. */
function buildBody(s: ReportSection): string {
  const bullets = (items: string[]) =>
    items.length > 0
      ? items.map((i) => `- ${i}`).join("\n")
      : "- (sem registos)";

  return [
    "## O que foi feito",
    bullets(s.done),
    "",
    "## Bloqueios e pontos de atenção",
    bullets(s.blocks),
    "",
    "## Próximos passos e decisões",
    bullets(s.next),
  ].join("\n");
}

/** Derives a human-readable week label from ISO date strings. */
function buildWeekLabel(start: string, end: string): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split("-");
    const months = [
      "", "jan", "fev", "mar", "abr", "mai", "jun",
      "jul", "ago", "set", "out", "nov", "dez",
    ];
    return `${parseInt(day)} ${months[parseInt(m)] ?? m}`;
  };
  const weekNum = isoWeekNumber(start);
  return `Semana ${weekNum} · ${fmt(start)}–${fmt(end)}`;
}

/** Returns the ISO week number (1-53) for a YYYY-MM-DD string. */
function isoWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const startOfWeek1 =
    jan4.getTime() - (jan4.getUTCDay() || 7) * 86400000 + 86400000;
  return Math.ceil((d.getTime() - startOfWeek1) / (7 * 86400000)) + 1;
}

/** Extracts task counts from the raw GitHub JSON blob. */
function extractTaskCounts(raw: unknown): {
  tasksCompleted: number;
  tasksPlanned: number;
} {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if ("tasks_completed" in obj && "tasks_planned" in obj) {
      return {
        tasksCompleted: Number(obj.tasks_completed) || 0,
        tasksPlanned: Number(obj.tasks_planned) || 0,
      };
    }
    if (Array.isArray(obj.tasks)) {
      const completed = (obj.tasks as Record<string, unknown>[]).filter(
        (t) =>
          t?.statusCategory === "done" ||
          t?.state === "CLOSED" ||
          t?.status === "Done"
      ).length;
      return { tasksCompleted: completed, tasksPlanned: obj.tasks.length };
    }
  }
  if (Array.isArray(raw)) {
    const completed = (raw as Record<string, unknown>[]).filter(
      (t) =>
        t?.statusCategory === "done" ||
        t?.state === "CLOSED" ||
        t?.status === "Done"
    ).length;
    return { tasksCompleted: completed, tasksPlanned: raw.length };
  }
  return { tasksCompleted: 0, tasksPlanned: 0 };
}

/* ------------------------------------------------------------------ */
/*  Clients                                                            */
/* ------------------------------------------------------------------ */

export async function getClients(): Promise<Client[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("clients")
    .select("*")
    .order("name");
  const rows = assertOk(result, "getClients");
  return rows.map(mapClient);
}

export async function getClient(id: string): Promise<Client | null> {
  if (!isUUID(id)) return null;

  const supabase = await createClient();
  const result = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (result.error) {
    console.warn(`[api] getClient(${id}):`, result.error.message);
    return null;
  }
  return result.data ? mapClient(result.data as ClientRow) : null;
}

export async function getClientByPortalToken(
  token: string,
): Promise<Client | null> {
  if (!isUUID(token)) return null;
  const data = await getPortalData(token);
  return data?.client ?? null;
}

/* ------------------------------------------------------------------ */
/*  Reports                                                            */
/* ------------------------------------------------------------------ */

export async function getReports(): Promise<Report[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("reports")
    .select("*")
    .order("period_start", { ascending: false });
  const rows = assertOk(result, "getReports");
  return rows.map((r) => mapReport(r));
}

export async function getReport(id: string): Promise<Report | null> {
  if (!isUUID(id)) return null;

  const supabase = await createClient();
  const result = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (result.error) {
    console.warn(`[api] getReport(${id}):`, result.error.message);
    return null;
  }
  const row = result.data as ReportRow | null;
  if (!row) return null;

  let errorMessage: string | null = null;
  if (row.status === "failed") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logRes: any = await supabase
        .from("delivery_logs")
        .select("error_message")
        .eq("report_id", id)
        .eq("status", "failed")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (logRes.data?.error_message) {
        errorMessage = logRes.data.error_message;
      }
    } catch {
      // Fallback handled by mapReport
    }
  }

  return mapReport(row, errorMessage);
}

export async function getReportsForClient(clientId: string): Promise<Report[]> {
  if (!isUUID(clientId)) return [];

  const supabase = await createClient();
  const result = await supabase
    .from("reports")
    .select("*")
    .eq("client_id", clientId)
    .order("period_start", { ascending: false });
  const rows = assertOk(result, `getReportsForClient(${clientId})`);
  return rows.map((r) => mapReport(r));
}

export async function getPendingReports(): Promise<Report[]> {
  const supabase = await createClient();
  // "pending_approval" in the UI maps to "approved" in the DB;
  // "draft" maps directly to "draft".
  const result = await supabase
    .from("reports")
    .select("*")
    .in("status", ["draft", "approved"])
    .order("period_start", { ascending: false });
  const rows = assertOk(result, "getPendingReports");
  return rows.map((r) => mapReport(r));
}

export async function getFailedReports(): Promise<Report[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("reports")
    .select("*")
    .eq("status", "failed")
    .order("period_start", { ascending: false });
  const rows = assertOk(result, "getFailedReports");
  return rows.map((r) => mapReport(r));
}

export async function getSentReports(): Promise<Report[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("reports")
    .select("*")
    .eq("status", "sent")
    .order("sent_at", { ascending: false });
  const rows = assertOk(result, "getSentReports");
  return rows.map((r) => mapReport(r));
}

/** Most recent report for a portal token, plus its history and metrics. */
export async function getPortalData(
  token: string,
): Promise<{
  client: Client;
  current: Report | null;
  history: Report[];
  metrics: SprintMetric[];
} | null> {
  if (!isUUID(token)) return null;

  const supabase = await createClient();

  // Primary path: Use the SECURITY DEFINER RPC get_portal_data_by_token
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcRes: any = await (supabase.rpc as any)("get_portal_data_by_token", {
    p_token: token,
  });

  if (!rpcRes.error && rpcRes.data) {
    const payload = rpcRes.data as {
      client: ClientRow;
      reports: ReportRow[];
      metrics: SprintMetricRow[];
    };

    if (!payload.client) return null;

    const client = mapClient(payload.client);
    const reports = (payload.reports ?? []).map((r) => mapReport(r));
    const metrics = (payload.metrics ?? []).map(mapSprintMetric);

    return {
      client,
      current: reports[0] ?? null,
      history: reports,
      metrics,
    };
  }

  // Graceful fallback (if RPC is not yet deployed on database)
  const clientRes = await supabase
    .from("clients")
    .select("*")
    .eq("portal_token", token)
    .maybeSingle();

  if (clientRes.error || !clientRes.data) return null;
  const client = mapClient(clientRes.data as ClientRow);

  const [history, metrics] = await Promise.all([
    getReportsForClient(client.id),
    getSprintMetrics(client.id),
  ]);

  return {
    client,
    current: history[0] ?? null,
    history,
    metrics,
  };
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();

  // Count queries run in parallel (head-only, no row data returned).
  const [pendingResult, sentResult, activeResult] = await Promise.all([
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "approved"]),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true }),
  ]);

  // Fetch report rows separately to avoid TypeScript narrowing issues
  // when mixing head-only and data-returning queries inside Promise.all.
  const reportsResult = await supabase.from("reports").select("*");

  const pending = pendingResult.count ?? 0;
  const sentThisMonth = sentResult.count ?? 0;
  const activeClients = activeResult.count ?? 0;

  if (reportsResult.error) {
    throw new Error(`[api] getDashboardSummary/reports: ${reportsResult.error.message}`);
  }
  const allReports: ReportRow[] = (reportsResult.data as ReportRow[] | null) ?? [];
  let totalDone = 0;
  let totalPlanned = 0;
  let failed = 0;
  for (const r of allReports) {
    const counts = extractTaskCounts(r.raw_github_data);
    totalDone += counts.tasksCompleted;
    totalPlanned += counts.tasksPlanned;
    if (r.status === "failed") {
      failed++;
    }
  }

  return {
    pending,
    sentThisMonth,
    activeClients,
    failed,
    avgCompletionRate: Math.round(
      (totalDone / Math.max(totalPlanned, 1)) * 100,
    ),
    timeSavedHours: Math.round(sentThisMonth * 2.5),
  };
}

export async function getSprintCards(): Promise<SprintCard[]> {
  const supabase = await createClient();
  // report_tasks is the source of sprint board cards.
  // Join with reports to get only tasks from the most recent (non-sent) report.
  const result = await supabase
    .from("report_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (result.error) {
    // report_tasks may be empty during early onboarding — return empty gracefully.
    console.warn("[api] getSprintCards:", result.error.message);
    return [];
  }

  return (result.data ?? []).map(mapReportTask);
}

export async function getSprintMetrics(clientId: string): Promise<SprintMetric[]> {
  const supabase = await createClient();
  let query = supabase.from("sprint_metrics").select("*");

  if (isUUID(clientId)) {
    query = query.eq("client_id", clientId);
  }

  const result = await query.order("sprint");
  if (result.error) {
    console.warn(`[api] getSprintMetrics(${clientId}):`, result.error.message);
    return [];
  }

  let rows = (result.data as SprintMetricRow[] | null) ?? [];

  // Auto-backfill if client has reports but no sprint_metrics yet
  if (rows.length === 0 && isUUID(clientId)) {
    rows = await syncSprintMetricsFromReports(clientId);
  }

  return rows.map(mapSprintMetric);
}

/**
 * Synchronizes and calculates sprint_metrics from existing reports for a client.
 * Dispatched automatically or on demand when metrics are synced.
 */
export async function syncSprintMetricsFromReports(
  clientId: string,
): Promise<SprintMetricRow[]> {
  if (!isUUID(clientId)) return [];

  const supabase = await createClient();

  // 1. Try database RPC function first
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcRes = await (supabase.rpc as any)("sync_client_sprint_metrics", {
      p_client_id: clientId,
    });
    if (!rpcRes.error && rpcRes.data?.metrics?.length > 0) {
      const refreshed = await supabase
        .from("sprint_metrics")
        .select("*")
        .eq("client_id", clientId)
        .order("sprint");
      if (refreshed.data && refreshed.data.length > 0) {
        return refreshed.data as SprintMetricRow[];
      }
    }
  } catch {
    // Fall back to client-side derivation below
  }

  // 2. Fallback: derive metrics from client reports directly
  const { data: reports, error } = await supabase
    .from("reports")
    .select("*")
    .eq("client_id", clientId)
    .order("period_end", { ascending: true });

  if (error || !reports || reports.length === 0) return [];

  const metricsToUpsert: {
    client_id: string;
    agency_id: string;
    sprint: string;
    label: string;
    completed: number;
    planned: number;
  }[] = [];

  for (const r of reports as ReportRow[]) {
    const weekNum = isoWeekNumber(r.period_end);
    const sprint = `S${weekNum}`;
    const label = `Semana ${weekNum}`;
    const counts = extractTaskCounts(r.raw_github_data);

    let completed = counts.tasksCompleted;
    let planned = counts.tasksPlanned;

    if (planned === 0 && r.summary_done) {
      completed = splitLines(r.summary_done).length;
      planned = completed;
    }

    metricsToUpsert.push({
      client_id: r.client_id,
      agency_id: r.agency_id,
      sprint,
      label,
      completed,
      planned,
    });
  }

  if (metricsToUpsert.length > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("sprint_metrics") as any).upsert(metricsToUpsert, {
        onConflict: "client_id,sprint",
      });
    } catch (e) {
      console.warn("[api] Error upserting derived sprint metrics:", e);
    }
  }

  const result = await supabase
    .from("sprint_metrics")
    .select("*")
    .eq("client_id", clientId)
    .order("sprint");

  return (result.data as SprintMetricRow[] | null) ?? [];
}

/**
 * Manually records or updates a sprint metric for a client.
 */
export async function recordSprintMetric(data: {
  clientId: string;
  agencyId: string;
  sprint: string;
  label: string;
  completed: number;
  planned: number;
}): Promise<SprintMetric | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (supabase.from("sprint_metrics") as any)
    .upsert(
      {
        client_id: data.clientId,
        agency_id: data.agencyId,
        sprint: data.sprint,
        label: data.label,
        completed: data.completed,
        planned: data.planned,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,sprint" },
    )
    .select("*")
    .single();

  if (result.error) {
    console.warn("[api] recordSprintMetric error:", result.error.message);
    return null;
  }
  return mapSprintMetric(result.data as SprintMetricRow);
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Approves a report and sends it via the approve-and-send Edge Function.
 * Updates status to 'sent' and dispatches transactional email with the portal link.
 */
export async function approveAndSend(
  id: string,
  editedBody: string,
): Promise<{ report: Report; isMock: boolean }> {
  const sections = parseBodyToSections(editedBody);

  const res = await invokeEdgeFunction<{
    success: boolean;
    report_id: string;
    status: string;
    mock?: boolean;
    is_mock_delivery?: boolean;
  }>("approve-and-send", {
    report_id: id,
    updated_blocks: sections
      ? {
          done: sections.done.join("\n"),
          blockers: sections.blocks.join("\n"),
          next_steps: sections.next.join("\n"),
        }
      : undefined,
  });

  const updated = await getReport(id);
  if (!updated) {
    throw new Error(`[api] Falha ao recuperar o relatório aprovado (${id})`);
  }
  return { report: updated, isMock: Boolean(res.mock || res.is_mock_delivery) };
}

/**
 * Retries sending an existing report via the approve-and-send Edge Function.
 * Reuses the existing 3 blocks stored in the report without modification.
 */
export async function resendReport(
  id: string,
): Promise<{ report: Report; isMock: boolean }> {
  const res = await invokeEdgeFunction<{
    success: boolean;
    report_id: string;
    status: string;
    mock?: boolean;
    is_mock_delivery?: boolean;
  }>("approve-and-send", {
    report_id: id,
  });

  const updated = await getReport(id);
  if (!updated) {
    throw new Error(`[api] Falha ao recuperar o relatório reenviado (${id})`);
  }
  return { report: updated, isMock: Boolean(res.mock || res.is_mock_delivery) };
}

/**
 * Generates an executive weekly report on-demand for a client via the generate-report Edge Function.
 * Fetches recent GitHub task items, synthesizes them with Gemini AI, and creates a new draft.
 */
export async function generateReportOnDemand(
  clientId: string,
  customNotes?: string,
): Promise<{ reportId: string }> {
  const res = await invokeEdgeFunction<{
    success: boolean;
    report_id: string;
    client_id: string;
    status: string;
  }>("generate-report", {
    client_id: clientId,
    custom_notes: customNotes,
    period_days: 7,
  });

  if (!res.report_id) {
    throw new Error("O servidor não devolveu o identificador do relatório gerado.");
  }

  return { reportId: res.report_id };
}

/**
 * Saves client column mapping in the database.
 */
export async function updateClientColumnMapping(
  clientId: string,
  columnMapping: Record<string, string[]>,
): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("clients") as any)
    .update({ column_mapping: columnMapping })
    .eq("id", clientId);

  if (error) {
    throw new Error(`[api] updateClientColumnMapping: ${error.message}`);
  }
}

/**
 * Updates the auto_send_enabled flag for a client.
 */
export async function updateClientAutoSend(
  clientId: string,
  autoSendEnabled: boolean,
): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("clients") as any)
    .update({ auto_send_enabled: autoSendEnabled })
    .eq("id", clientId);

  if (error) {
    throw new Error(`[api] updateClientAutoSend: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Pure utilities — still exported for components that import them    */
/* ------------------------------------------------------------------ */

import { parseBodyToSections } from "@/lib/report-utils";
export { parseBodyToSections };

/**
 * @deprecated In-memory override — kept only for test isolation.
 * In production the DB is the single source of truth.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function applyReportOverride(_id: string, _patch: Partial<Report>) {
  // No-op: mutations now go directly to Supabase via approveAndSend.
}

/**
 * @deprecated In-memory read with override — kept only for test isolation.
 * Use getReport(id) instead.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function readReportWithOverrides(_id: string): Report | null {
  return null;
}

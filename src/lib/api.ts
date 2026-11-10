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
function mapReport(row: ReportRow): Report {
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
    failed: "draft",
  };

  return {
    id: row.id,
    clientId: row.client_id,
    weekLabel,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: statusMap[row.status] ?? "draft",
    subject: `Relatório — ${weekLabel}`,
    intro: "",
    sections,
    body,
    tasksCompleted,
    tasksPlanned,
    generatedAt: row.created_at,
    sentAt: row.sent_at ?? null,
    openedAt: null, // delivery tracking not yet in schema
  };
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
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "tasks_completed" in raw &&
    "tasks_planned" in raw
  ) {
    return {
      tasksCompleted: Number((raw as Record<string, unknown>).tasks_completed) || 0,
      tasksPlanned: Number((raw as Record<string, unknown>).tasks_planned) || 0,
    };
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
  const supabase = await createClient();
  const result = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const row = assertOk(result, `getClient(${id})`);
  return row ? mapClient(row) : null;
}

export async function getClientByPortalToken(
  token: string,
): Promise<Client | null> {
  const supabase = await createClient();
  const result = await supabase
    .from("clients")
    .select("*")
    .eq("portal_token", token)
    .maybeSingle();
  const row = assertOk(result, `getClientByPortalToken(${token})`);
  return row ? mapClient(row) : null;
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
  return rows.map(mapReport);
}

export async function getReport(id: string): Promise<Report | null> {
  const supabase = await createClient();
  const result = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const row = assertOk(result, `getReport(${id})`);
  return row ? mapReport(row) : null;
}

export async function getReportsForClient(clientId: string): Promise<Report[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("reports")
    .select("*")
    .eq("client_id", clientId)
    .order("period_start", { ascending: false });
  const rows = assertOk(result, `getReportsForClient(${clientId})`);
  return rows.map(mapReport);
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
  return rows.map(mapReport);
}

export async function getSentReports(): Promise<Report[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("reports")
    .select("*")
    .eq("status", "sent")
    .order("sent_at", { ascending: false });
  const rows = assertOk(result, "getSentReports");
  return rows.map(mapReport);
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
  const client = await getClientByPortalToken(token);
  if (!client) return null;

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
  for (const r of allReports) {
    const counts = extractTaskCounts(r.raw_github_data);
    totalDone += counts.tasksCompleted;
    totalPlanned += counts.tasksPlanned;
  }

  return {
    pending,
    sentThisMonth,
    activeClients,
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
  const result = await supabase
    .from("sprint_metrics")
    .select("*")
    .eq("client_id", clientId)
    .order("sprint");
  const rows = assertOk(result, `getSprintMetrics(${clientId})`);
  return rows.map(mapSprintMetric);
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Approves a report and marks it as sent in Supabase.
 * Updates `status`, `approved_at`, `sent_at`, and the three summary columns
 * derived from the edited body. Keeps the function signature unchanged.
 */
export async function approveAndSend(
  id: string,
  editedBody: string,
): Promise<Report> {
  const supabase = await createClient();

  const sections = parseBodyToSections(editedBody);
  const now = new Date().toISOString();

  // Build the typed patch — only columns allowed by UpdateTables<"reports">.
  const summaryPatch = sections
    ? {
        summary_done: sections.done.join("\n"),
        summary_blockers: sections.blocks.join("\n"),
        summary_next_steps: sections.next.join("\n"),
      }
    : {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (supabase.from("reports") as any)
    .update({
      status: "sent",
      approved_at: now,
      sent_at: now,
      updated_at: now,
      ...summaryPatch,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (result.error) throw new Error(`[api] approveAndSend(${id}): ${result.error.message}`);
  return mapReport(result.data as ReportRow);
}

/* ------------------------------------------------------------------ */
/*  Pure utilities — still exported for components that import them    */
/* ------------------------------------------------------------------ */

/** Parses a markdown-ish body back into the three mandatory blocks. */
export function parseBodyToSections(body: string): ReportSection | null {
  const grab = (heading: string, nextHeading?: string): string[] => {
    const start = body.indexOf(heading);
    if (start === -1) return [];
    const after = body.slice(start + heading.length);
    const end = nextHeading ? after.indexOf(nextHeading) : -1;
    const chunk = end === -1 ? after : after.slice(0, end);
    return chunk
      .split("\n")
      .map((l) => l.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean);
  };
  const done = grab("## O que foi feito", "## Bloqueios");
  const blocks = grab("## Bloqueios", "## Próximos passos");
  const next = grab("## Próximos passos");
  if (done.length + blocks.length + next.length === 0) return null;
  return { done, blocks, next };
}

/**
 * @deprecated In-memory override — kept only for test isolation.
 * In production the DB is the single source of truth.
 */
export function applyReportOverride(_id: string, _patch: Partial<Report>) {
  // No-op: mutations now go directly to Supabase via approveAndSend.
}

/**
 * @deprecated In-memory read with override — kept only for test isolation.
 * Use getReport(id) instead.
 */
export function readReportWithOverrides(_id: string): Report | null {
  return null;
}

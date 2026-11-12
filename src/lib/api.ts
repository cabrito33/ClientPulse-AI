/**
 * Data access layer.
 *
 * The whole UI talks to these functions only. Today they read from
 * `src/data/*`; tomorrow each one becomes a Supabase query or a GitHub call
 * without touching a single component. Keep the signatures stable.
 */
import { clients, clientsById } from "@/data/clients";
import { reports, reportsById } from "@/data/reports";
import { sprintCards, sprintMetrics, type SprintCard } from "@/data/metrics";
import type {
  Client,
  DashboardSummary,
  Report,
  ReportSection,
  SprintMetric,
} from "@/data/types";

// Small artificial delay so loading states are exercised in dev.
const LATENCY_MS = 0; // set to e.g. 250 to simulate network in development

async function settle<T>(value: T): Promise<T> {
  if (LATENCY_MS > 0) await new Promise((r) => setTimeout(r, LATENCY_MS));
  return value;
}

/* ------------------------------------------------------------------ */
/*  Clients                                                            */
/* ------------------------------------------------------------------ */

export async function getClients(): Promise<Client[]> {
  return settle(clients);
}

export async function getClient(id: string): Promise<Client | null> {
  return settle(clientsById[id] ?? null);
}

export async function getClientByPortalToken(token: string): Promise<Client | null> {
  return settle(clients.find((c) => c.portalToken === token) ?? null);
}

/* ------------------------------------------------------------------ */
/*  Reports                                                            */
/* ------------------------------------------------------------------ */

export async function getReports(): Promise<Report[]> {
  const merged = reports.map((r) => readReportWithOverrides(r.id) ?? r);
  return settle(merged);
}

export async function getReport(id: string): Promise<Report | null> {
  const merged = readReportWithOverrides(id) ?? reportsById[id] ?? null;
  return settle(merged);
}

export async function getReportsForClient(clientId: string): Promise<Report[]> {
  return settle(
    reports
      .filter((r) => r.clientId === clientId)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
  );
}

export async function getPendingReports(): Promise<Report[]> {
  return settle(reports.filter((r) => r.status === "pending_approval" || r.status === "draft"));
}

export async function getSentReports(): Promise<Report[]> {
  return settle(reports.filter((r) => r.status === "sent"));
}

/** Most recent report for a portal token, plus its history. */
export async function getPortalData(
  token: string,
): Promise<{ client: Client; current: Report | null; history: Report[]; metrics: SprintMetric[] } | null> {
  const client = await getClientByPortalToken(token);
  if (!client) return null;
  const history = await getReportsForClient(client.id);
  return {
    client,
    current: history[0] ?? null,
    history,
    metrics: sprintMetrics[client.id] ?? [],
  };
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const pending = reports.filter(
    (r) => r.status === "pending_approval" || r.status === "draft",
  ).length;
  const sentThisMonth = reports.filter((r) => r.status === "sent").length;
  const activeClients = clients.filter((c) => c.status === "active").length;
  const totalDone = reports.reduce((s, r) => s + r.tasksCompleted, 0);
  const totalPlanned = reports.reduce((s, r) => s + r.tasksPlanned, 0);
  return settle({
    pending,
    sentThisMonth,
    activeClients,
    avgCompletionRate: Math.round((totalDone / Math.max(totalPlanned, 1)) * 100),
    // 2h30 saved per report × sent reports — an illustrative figure for the demo.
    timeSavedHours: Math.round(sentThisMonth * 2.5),
  });
}

export async function getSprintCards(): Promise<SprintCard[]> {
  return settle(sprintCards);
}

export async function getSprintMetrics(clientId: string): Promise<SprintMetric[]> {
  return settle(sprintMetrics[clientId] ?? []);
}

/* ------------------------------------------------------------------ */
/*  Mutations (in-memory only for the prototype)                       */
/* ------------------------------------------------------------------ */

const reportOverrides = new Map<string, Partial<Report>>();

/** Applies a local override so the UI reflects approvals within the session. */
export function applyReportOverride(id: string, patch: Partial<Report>) {
  reportOverrides.set(id, { ...(reportOverrides.get(id) ?? {}), ...patch });
}

/**
 * Records the first open timestamp of a report (BE-21).
 *
 * CRITÉRIOS DE ACEITAÇÃO:
 * 1. Regista data/hora da primeira abertura.
 * 2. Pedidos repetidos não sobrescrevem o primeiro registo (idempotência).
 */
export async function recordReportOpen(
  reportId: string,
  timestamp?: string
): Promise<{ success: boolean; reportId: string; openedAt: string; isFirstOpen: boolean }> {
  const current = readReportWithOverrides(reportId) ?? reportsById[reportId];
  if (!current) {
    throw new Error(`Relatório com id '${reportId}' não encontrado.`);
  }

  // Acceptance Criterion 3: Repeated requests NEVER overwrite the first timestamp
  if (current.openedAt) {
    return {
      success: true,
      reportId: current.id,
      openedAt: current.openedAt,
      isFirstOpen: false,
    };
  }

  // Acceptance Criterion 1: Record timestamp of first open
  const recordedTime = timestamp || new Date().toISOString();
  applyReportOverride(reportId, { openedAt: recordedTime });

  return {
    success: true,
    reportId: current.id,
    openedAt: recordedTime,
    isFirstOpen: true,
  };
}

export function readReportWithOverrides(id: string): Report | null {
  const base = reportsById[id];
  if (!base) return null;
  const patch = reportOverrides.get(id);
  return patch ? { ...base, ...patch } : base;
}

/** Kept for the future Supabase mutation; currently a no-op on the server. */
export async function approveAndSend(id: string, editedBody: string): Promise<Report> {
  const base = reportsById[id];
  if (!base) throw new Error("Relatório não encontrado");
  const sections = parseBodyToSections(editedBody) ?? base.sections;
  return {
    ...base,
    body: editedBody,
    sections,
    status: "sent",
    sentAt: new Date().toISOString(),
  };
}

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

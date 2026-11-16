import type { ReportSection } from "@/data/types";

export const REPORT_HEADINGS = {
  done: "## O que foi feito",
  blocks: "## Bloqueios e pontos de atenção",
  next: "## Próximos passos e decisões",
};

/**
 * Serializes report sections into markdown without trimming active trailing spaces.
 * Empty or purely whitespace items are omitted from output markdown.
 */
export function serializeReportSections(s: ReportSection, intro?: string): string {
  const bullets = (items: string[]) =>
    items
      .filter((i) => i.trim().length > 0)
      .map((i) => `- ${i.replace(/^(\s*[-*•◦▪]\s*)+/, "")}`)
      .join("\n");
  const blocks = [
    REPORT_HEADINGS.done,
    bullets(s.done),
    "",
    REPORT_HEADINGS.blocks,
    bullets(s.blocks),
    "",
    REPORT_HEADINGS.next,
    bullets(s.next),
  ];
  if (intro) {
    return [intro, "", ...blocks].join("\n");
  }
  return blocks.join("\n");
}

/**
 * Strips leading bullet markers (•, -, *, ◦, ▪) and excess whitespace from a line.
 */
export function cleanBullet(line: string): string {
  return line.replace(/^(\s*[-*•◦▪]\s*)+/, "").trim();
}

/** Parses a markdown-ish body back into the three mandatory blocks. */
export function parseBodyToSections(body: string): ReportSection | null {
  if (!body || typeof body !== "string") return null;

  const lines = body.split("\n");
  type SectionKey = "done" | "blocks" | "next" | null;
  let currentSection: SectionKey = null;

  const result: ReportSection = {
    done: [],
    blocks: [],
    next: [],
  };

  const isHeading = (line: string): SectionKey | false => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#")) return false;
    const lower = trimmed.toLowerCase();

    // Check Done section
    if (lower.includes("o que foi feito") || lower.includes("concluído") || lower.includes("feito")) {
      return "done";
    }
    // Check Blocks section (e.g. "## Bloqueios e pontos de atenção", "## Bloqueios")
    if (lower.includes("bloqueio") || lower.includes("impedimento") || (lower.includes("ponto") && lower.includes("atenção"))) {
      return "blocks";
    }
    // Check Next section (e.g. "## Próximos passos e decisões", "## Próximos passos")
    if (lower.includes("próximo") || lower.includes("proximo") || lower.includes("passo") || lower.includes("decis")) {
      return "next";
    }
    return false;
  };

  for (const line of lines) {
    const headingType = isHeading(line);
    if (headingType !== false) {
      currentSection = headingType;
      continue; // Consume the entire heading line cleanly without leaving remnants
    }

    if (!currentSection) continue;

    const trimmed = line.trim();
    if (!trimmed) continue; // Ignore empty lines

    // Ignore placeholder "(sem registos)" or "(nenhum)"
    if (/^\(?sem registos\)?$/i.test(trimmed) || /^\(?nenhum\)?$/i.test(trimmed)) {
      continue;
    }

    // Clean bullet marker(s) from the item
    const cleaned = cleanBullet(trimmed);
    if (cleaned) {
      result[currentSection].push(cleaned);
    }
  }

  if (result.done.length + result.blocks.length + result.next.length === 0) {
    return null;
  }
  return result;
}

/**
 * Extracts task counts from the raw GitHub JSON blob or PostgREST JSON projections.
 * Pure function supporting:
 * - Direct object with tasks_completed and tasks_planned (numeric or string from PostgREST ->>)
 * - Object with nested tasks array
 * - Direct array of task items
 */
export function extractTaskCounts(raw: unknown): {
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

export interface DashboardSummaryCounts {
  pendingCount: number;
  sentCount: number;
  activeClientsCount: number;
  reportRows: Array<{
    status: string;
    tasks_completed?: number | string | null;
    tasks_planned?: number | string | null;
    raw_github_data?: unknown;
  }>;
}

/**
 * Pure calculation function for DashboardSummary metrics.
 * Reused across API layer and unit tests to ensure identical results.
 */
export function calculateDashboardSummary({
  pendingCount,
  sentCount,
  activeClientsCount,
  reportRows,
}: DashboardSummaryCounts): {
  pending: number;
  sentThisMonth: number;
  activeClients: number;
  failed: number;
  avgCompletionRate: number;
  timeSavedHours: number;
} {
  let totalDone = 0;
  let totalPlanned = 0;
  let failed = 0;

  for (const r of reportRows) {
    const counts = extractTaskCounts(r.raw_github_data ?? r);
    totalDone += counts.tasksCompleted;
    totalPlanned += counts.tasksPlanned;
    if (r.status === "failed") {
      failed++;
    }
  }

  return {
    pending: pendingCount,
    sentThisMonth: sentCount,
    activeClients: activeClientsCount,
    failed,
    avgCompletionRate: Math.round(
      (totalDone / Math.max(totalPlanned, 1)) * 100
    ),
    timeSavedHours: Math.round(sentCount * 2.5),
  };
}

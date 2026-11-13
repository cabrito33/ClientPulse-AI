/**
 * ==============================================================================
 * ClientPulse AI — Report Idempotency & ISO Week Deduplication Helper
 * File: supabase/functions/_shared/idempotency.ts
 *
 * Enforces acceptance criteria:
 * - A scheduled report or auto-send direct dispatch must NEVER execute twice
 *   for the same client in the same ISO week/period.
 * ==============================================================================
 */

/**
 * Calculates the ISO week number and ISO week-year for a given date.
 */
export function getIsoWeekYear(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

export interface ReportSummaryRecord {
  id: string;
  status?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  created_at?: string | null;
}

/**
 * Checks whether an existing report matches the target date's ISO week and year.
 * Returns the matching duplicate report, or null if no report exists for that week.
 */
export function findExistingWeekReport<T extends ReportSummaryRecord>(
  reports: T[],
  targetDate: Date,
): T | null {
  const targetIso = getIsoWeekYear(targetDate);
  for (const r of reports) {
    const dateStr = r.period_end || r.created_at;
    if (!dateStr) continue;
    const rDate = new Date(dateStr);
    if (isNaN(rDate.getTime())) continue;

    const rIso = getIsoWeekYear(rDate);
    if (rIso.year === targetIso.year && rIso.week === targetIso.week) {
      return r;
    }
  }
  return null;
}

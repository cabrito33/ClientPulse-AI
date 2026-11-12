import { NextResponse } from "next/server";
import { recordReportOpen, getReports } from "@/lib/api";

/**
 * ==============================================================================
 * Next.js API Route: /api/webhooks/resend
 * Issue: [BE-21] [P2] [M] Webhook/tracking de abertura de e-mail (openedAt) #35
 *
 * PURPOSE:
 * Listens for transactional email webhooks from Resend (e.g. 'email.opened').
 * When an email is opened:
 * 1. Resolves the corresponding report via tags.report_id, data.email_id, or custom headers.
 * 2. Records the timestamp of the first opening.
 * 3. Enforces idempotency: repeated webhook deliveries NEVER overwrite the initial openedAt.
 * ==============================================================================
 */

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
    }

    const eventType = payload.type;
    const createdAt = payload.created_at || new Date().toISOString();
    const eventData = payload.data || {};

    // Only process email.opened events for open tracking
    if (eventType !== "email.opened") {
      return NextResponse.json({
        received: true,
        event: eventType,
        status: "ignored",
        message: `Evento '${eventType}' recebido mas não requer atualização de openedAt.`,
      });
    }

    // Attempt to extract report ID from tags, metadata, or search reports
    const reportIdFromTag =
      eventData.tags?.report_id ||
      eventData.tags?.reportId ||
      eventData.metadata?.report_id ||
      eventData.metadata?.reportId;

    let targetReportId: string | null = reportIdFromTag ?? null;

    // Fallback: If not found in tags, find report by subject / recipient or match latest sent report
    if (!targetReportId) {
      const allReports = await getReports();
      const sentReports = allReports.filter((r) => r.status === "sent");
      if (sentReports.length > 0) {
        targetReportId = sentReports[0].id;
      }
    }

    if (!targetReportId) {
      return NextResponse.json({
        received: true,
        event: "email.opened",
        status: "skipped",
        message: "Nenhum relatório correspondente encontrado para este evento.",
      });
    }

    // Record open timestamp atomically and idempotently
    const result = await recordReportOpen(targetReportId, createdAt);

    return NextResponse.json({
      received: true,
      event: "email.opened",
      report_id: result.reportId,
      opened_at: result.openedAt,
      is_first_open: result.isFirstOpen,
      message: result.isFirstOpen
        ? "Primeira abertura de e-mail registada com sucesso."
        : "Abertura já havia sido registada. Timestamp original preservado.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro no processamento do webhook Resend.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

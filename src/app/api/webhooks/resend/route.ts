import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { recordReportOpen, getReports } from "@/lib/api";

/**
 * ==============================================================================
 * Next.js API Route: /api/webhooks/resend
 * Issue: [BE-21] [P2] [M] Webhook/tracking de abertura de e-mail (openedAt) #35
 *
 * PURPOSE:
 * Listens for transactional email webhooks from Resend (e.g. 'email.opened').
 *
 * SECURITY:
 * Verifies the Svix webhook signature (svix-id, svix-timestamp, svix-signature)
 * using HMAC-SHA256 and RESEND_WEBHOOK_SECRET. Returns 401 if invalid or missing.
 * ==============================================================================
 */

/**
 * Verifies standard Svix signature headers from Resend.
 */
function verifySvixSignature(
  payload: string,
  headers: Headers,
  secret: string,
): boolean {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Prevent replay attacks (tolerance of 5 minutes = 300 seconds)
  const timestampNum = parseInt(svixTimestamp, 10);
  if (isNaN(timestampNum)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampNum) > 300) {
    return false;
  }

  // Handle whsec_ prefix commonly used by Svix / Resend
  let secretBuffer: Buffer;
  try {
    const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    secretBuffer = secret.startsWith("whsec_")
      ? Buffer.from(cleanSecret, "base64")
      : Buffer.from(secret, "utf-8");
  } catch {
    secretBuffer = Buffer.from(secret, "utf-8");
  }

  const toSign = `${svixId}.${svixTimestamp}.${payload}`;
  const computedSignature = crypto
    .createHmac("sha256", secretBuffer)
    .update(toSign)
    .digest("base64");

  const signatures = svixSignature.split(" ");
  for (const versionedSig of signatures) {
    const [version, signature] = versionedSig.split(",");
    if (version === "v1" && signature) {
      try {
        const expectedBuf = Buffer.from(computedSignature, "base64");
        const actualBuf = Buffer.from(signature, "base64");
        if (
          expectedBuf.length === actualBuf.length &&
          crypto.timingSafeEqual(expectedBuf, actualBuf)
        ) {
          return true;
        }
      } catch {
        continue;
      }
    }
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Verify Svix signature. If secret is configured or in production, must be valid.
    if (!webhookSecret || !verifySvixSignature(rawBody, request.headers, webhookSecret)) {
      return NextResponse.json(
        { error: "Assinatura do webhook inválida ou não autorizada." },
        { status: 401 },
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
    }

    const eventType = payload.type;
    const createdAt = (payload.created_at as string) || new Date().toISOString();
    const eventData = (payload.data as Record<string, unknown>) || {};

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
    const tags = eventData.tags as Record<string, unknown> | undefined;
    const metadata = eventData.metadata as Record<string, unknown> | undefined;

    const reportIdFromTag =
      tags?.report_id ||
      tags?.reportId ||
      metadata?.report_id ||
      metadata?.reportId;

    let targetReportId: string | null =
      typeof reportIdFromTag === "string" ? reportIdFromTag : null;

    // Fallback: If not found in tags, find latest sent report
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
    const errorMsg =
      err instanceof Error ? err.message : "Erro no processamento do webhook Resend.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

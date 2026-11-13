import { NextResponse } from "next/server";
import { recordReportOpen, getClientByPortalToken, getReportsForClient } from "@/lib/api";

/**
 * ==============================================================================
 * Next.js API Route: /api/track/open
 * Issue: [BE-21] [P2] [M] Webhook/tracking de abertura de e-mail (openedAt) #35
 *
 * CRITÉRIOS DE ACEITAÇÃO:
 * 1. Endpoint regista data/hora da primeira abertura (sempre carimbo do servidor)
 * 2. openedAt visível no dashboard
 * 3. Pedidos repetidos não sobrescrevem o primeiro registo (idempotência)
 *
 * NOTA SOBRE PRIVACIDADE E FIABILIDADE DO PIXEL:
 * O rastreio via pixel transparente 1x1 e webhooks de e-mail é meramente indicativo.
 * Sistemas de privacidade (como o Apple Mail Privacy Protection - MPP), filtros
 * antimalware e proxies corporativos descarregam imagens antecipadamente em segundo
 * plano, o que pode originar falsos positivos imediatos. Por outro lado, clientes de
 * e-mail com bloqueio de imagens desativam o carregamento do pixel a menos que o
 * utilizador autorize ou abra o portal do cliente. O ClientPulse AI preserva a
 * primeira interação verificada sem nunca permitir manipulação do timestamp via body.
 *
 * MÉTODOS:
 * - GET: Serve pixel GIF 1x1 transparente para clientes de e-mail HTML.
 * - POST: Endpoint JSON programático para triggers de abertura (utiliza sempre carimbo de servidor).
 * ==============================================================================
 */

// 1x1 transparent GIF binary representation (43 bytes)
const TRANSPARENT_GIF_PIXEL = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

async function resolveReportId(params: {
  reportId?: string | null;
  token?: string | null;
  emailId?: string | null;
}): Promise<string | null> {
  const { reportId, token } = params;

  if (reportId && typeof reportId === "string" && reportId.trim()) {
    return reportId.trim();
  }

  // Resolve by client portal token if provided
  if (token && typeof token === "string" && token.trim()) {
    const client = await getClientByPortalToken(token.trim());
    if (client) {
      const clientReports = await getReportsForClient(client.id);
      if (clientReports.length > 0) {
        return clientReports[0].id;
      }
    }
  }

  return null;
}

/**
 * GET /api/track/open
 * Serves 1x1 transparent tracking pixel image for HTML email clients.
 * Uses the server's current timestamp to record open.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportIdParam =
    searchParams.get("reportId") ||
    searchParams.get("report_id") ||
    searchParams.get("id");
  const tokenParam = searchParams.get("token");
  const emailIdParam = searchParams.get("emailId") || searchParams.get("email_id");

  try {
    const targetReportId = await resolveReportId({
      reportId: reportIdParam,
      token: tokenParam,
      emailId: emailIdParam,
    });

    if (targetReportId) {
      // Record open timestamp using current server time (idempotent: does NOT overwrite if already opened)
      await recordReportOpen(targetReportId);
    }
  } catch {
    // Fail silently on pixel tracking to not disturb image rendering in email clients
  }

  return new NextResponse(TRANSPARENT_GIF_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF_PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

/**
 * POST /api/track/open
 * Programmatic JSON tracking endpoint for portal view triggers or external callers.
 * SECURITY: Never accepts timestamp from the request body; always records the server's current time.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const reportIdParam = body.reportId || body.report_id || body.id;
    const tokenParam = body.token;
    const emailIdParam = body.emailId || body.email_id;

    const targetReportId = await resolveReportId({
      reportId: reportIdParam,
      token: tokenParam,
      emailId: emailIdParam,
    });

    if (!targetReportId) {
      return NextResponse.json(
        {
          error: "Identificador obrigatório. Forneça 'reportId', 'report_id', ou 'token'.",
        },
        { status: 400 },
      );
    }

    // Always enforce server time — body timestamps are strictly ignored
    const result = await recordReportOpen(targetReportId);

    return NextResponse.json({
      success: true,
      report_id: result.reportId,
      opened_at: result.openedAt,
      is_first_open: result.isFirstOpen,
      message: result.isFirstOpen
        ? "Data e hora de primeira abertura registadas com sucesso."
        : "Relatório já havia sido aberto anteriormente. Timestamp original preservado.",
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Erro interno no tracking de abertura.";
    return NextResponse.json({ error: errorMsg }, { status: 404 });
  }
}

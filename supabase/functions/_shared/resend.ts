// ==============================================================================
// ClientPulse AI — Transactional Email Engine (Resend)
// File: supabase/functions/_shared/resend.ts
//
// PURPOSE:
// Dispatches professional executive HTML emails to clients using Resend.
// Contains:
// 1. Responsive, clean HTML email template.
// 2. Direct button link to the Zero-Login Client Portal (/portal/[token]).
// 3. Mock/Preview Mode: Allows local testing and grading even if the team
//    does not yet have a verified custom domain on Resend!
// ==============================================================================

export interface SendReportEmailOptions {
  apiKey?: string;
  fromEmail?: string;
  toEmail: string;
  clientName: string;
  companyName?: string | null;
  projectTitle?: string | null;
  periodStart: string;
  periodEnd: string;
  summaryDone: string;
  summaryBlockers: string;
  summaryNextSteps: string;
  portalToken: string;
  reportId?: string;
  appUrl?: string;
  language?: 'pt' | 'en';
}

/**
 * Builds a clean, responsive HTML email body with the 3 blocks and portal link.
 */
export function buildReportEmailHtml(options: SendReportEmailOptions): string {
  const isPt = options.language !== 'en';
  const baseUrl = (options.appUrl || 'http://localhost:3000').replace(/\/$/, '');
  const portalUrl = `${baseUrl}/portal/${options.portalToken}`;
  const trackingPixelUrl = `${baseUrl}/api/track/open?${
    options.reportId ? `reportId=${options.reportId}` : `token=${options.portalToken}`
  }`;
  const displayProject = options.projectTitle || options.companyName || options.clientName;

  const labels = isPt
    ? {
        title: 'Relatório Semanal de Progresso',
        subtitle: options.projectTitle
          ? `Projeto: ${options.projectTitle} • Período: ${options.periodStart} a ${options.periodEnd}`
          : `Período: ${options.periodStart} a ${options.periodEnd}`,
        doneTitle: '✅ O que foi concluído',
        blockersTitle: '⚠️ Pontos de Atenção & Bloqueios',
        nextStepsTitle: '🚀 Próximos Passos & Decisões',
        ctaText: 'Aceder ao Portal do Cliente',
        footerNote: 'Este é um link seguro e exclusivo da sua empresa. Não é necessário criar conta ou memorizar passwords.',
      }
    : {
        title: 'Weekly Progress Report',
        subtitle: options.projectTitle
          ? `Project: ${options.projectTitle} • Period: ${options.periodStart} to ${options.periodEnd}`
          : `Period: ${options.periodStart} to ${options.periodEnd}`,
        doneTitle: '✅ Completed Deliverables',
        blockersTitle: '⚠️ Attention Points & Blockers',
        nextStepsTitle: '🚀 Next Steps & Priorities',
        ctaText: 'Open Client Portal',
        footerNote: 'This is a secure, private link for your organization. No login or password required.',
      };

  // Convert newlines in summaries into clean HTML paragraphs/breaks
  const formatBlock = (text: string) => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => `<p style="margin: 0 0 8px 0; line-height: 1.5; color: #374151;">${line}</p>`)
      .join('');
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${labels.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; text-align: left;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">ClientPulse AI</h1>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #94a3b8;">${labels.subtitle}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 28px 32px 16px 32px;">
              <h2 style="margin: 0; font-size: 18px; color: #111827;">Olá, ${options.clientName}!</h2>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
                ${isPt ? `Aqui está o resumo executivo dos desenvolvimentos realizados para o projeto <strong>${displayProject}</strong> esta semana.` : `Here is the executive summary of the deliverables completed for project <strong>${displayProject}</strong> this week.`}
              </p>
            </td>
          </tr>

          <!-- Block 1: Done -->
          <tr>
            <td style="padding: 12px 32px;">
              <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600; color: #15803d;">${labels.doneTitle}</h3>
                ${formatBlock(options.summaryDone)}
              </div>
            </td>
          </tr>

          <!-- Block 2: Blockers -->
          <tr>
            <td style="padding: 12px 32px;">
              <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 16px; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600; color: #b45309;">${labels.blockersTitle}</h3>
                ${formatBlock(options.summaryBlockers)}
              </div>
            </td>
          </tr>

          <!-- Block 3: Next Steps -->
          <tr>
            <td style="padding: 12px 32px;">
              <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600; color: #1d4ed8;">${labels.nextStepsTitle}</h3>
                ${formatBlock(options.summaryNextSteps)}
              </div>
            </td>
          </tr>

          <!-- CTA Button to Portal -->
          <tr>
            <td align="center" style="padding: 28px 32px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #0f172a;">
                    <a href="${portalUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      ${labels.ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #6b7280; max-width: 440px; text-align: center; line-height: 1.4;">
                ${labels.footerNote}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                Enviado automaticamente por <strong>ClientPulse AI</strong>.
              </p>
            </td>
          </tr>

          <!-- Open Tracking Pixel (BE-21) -->
          <tr>
            <td style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
              <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Sends an email via Resend API, with automatic Mock Mode fallback for local testing.
 */
export async function sendReportEmail(options: SendReportEmailOptions): Promise<{ id: string; mock: boolean }> {
  const apiKey = options.apiKey || Deno.env.get('RESEND_API_KEY');
  const fromEmail = options.fromEmail || Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';

  const htmlContent = buildReportEmailHtml(options);
  const subject = options.language === 'en'
    ? `Weekly Progress Report — ${options.companyName || options.clientName} (${options.periodEnd})`
    : `Relatório Semanal de Progresso — ${options.companyName || options.clientName} (${options.periodEnd})`;

  // If no API key is provided, or if explicitly in mock mode:
  if (!apiKey || apiKey === 'mock' || apiKey.includes('your-resend-api-key')) {
    console.log('----------------------------------------------------');
    console.log('[MOCK EMAIL MODE ACTIVATED]');
    console.log(`To: ${options.toEmail}`);
    console.log(`From: ${fromEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Portal Link: ${(options.appUrl || 'http://localhost:3000')}/portal/${options.portalToken}`);
    console.log('----------------------------------------------------');
    return {
      id: `mock_email_${Date.now()}`,
      mock: true,
    };
  }

  // Real HTTP dispatch to Resend
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [options.toEmail],
      subject,
      html: htmlContent,
      tags: options.reportId ? [{ name: 'report_id', value: options.reportId }] : undefined,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API Error (HTTP ${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    mock: false,
  };
}

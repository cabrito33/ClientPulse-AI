// ClientPulse AI — deprecated Edge Function: email-tracking
//
// SECURITY NOTICE:
// This legacy endpoint previously wrote reports.opened_at through the service
// role using caller-controlled report IDs, tokens and timestamps. Its GET route
// also bypassed the active/expired/revoked portal-token lifecycle.
//
// We intentionally retire ALL privileged writes here. The supported routes
// are the Next.js signed Resend webhook (/api/webhooks/resend), the Next.js
// tracking pixel (/api/track/open) and the token-validated portal SQL RPC.
// Those paths have their own separate validation limitations documented in
// docs/FINAL_AUDIT.md and must be tested independently.
//
// The transparent GIF remains for backwards compatibility with old image URLs,
// but DOES NOT record an opening. Publishing this function must be reviewed
// separately; do not change Resend settings or JWT verification.

import { corsHeaders, handleCors } from '../_shared/cors.ts';

const TRANSPARENT_GIF_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

Deno.serve((req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method === 'GET') {
    return new Response(TRANSPARENT_GIF_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }

  if (req.method === 'POST') {
    return new Response(JSON.stringify({
      error: 'Legacy tracking writes are disabled. Use the signed Resend webhook or token-validated portal path.',
    }), {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed. Use GET or POST.' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

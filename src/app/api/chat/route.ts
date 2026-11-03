import { NextResponse } from "next/server";

/**
 * Next.js API Route: /api/chat
 * Acts as a proxy/gateway for PulseBot (Onboarding Assistant & FAQ)
 * forwards requests to the Supabase Edge Function 'onboarding-chat' or processes them seamlessly.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { message, conversation_history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Mensagem obrigatória." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // If Supabase Edge Function is deployed/configured
    if (supabaseUrl && anonKey) {
      const edgeFunctionUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/onboarding-chat`;

      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": request.headers.get("Authorization") || `Bearer ${anonKey}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({ message, conversation_history }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    }

    // Fallback response for offline / mock testing
    return NextResponse.json({
      reply:
        "Olá! Sou o PulseBot. Conecta o teu Personal Access Token do GitHub com permissão 'read:project' para começarmos a configurar o teu primeiro projeto!",
      action_detected: { action: "awaiting_pat" },
      github_status: { is_connected: false, username: null },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno no chatbot.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

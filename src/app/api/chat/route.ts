import { NextResponse } from "next/server";
import { processOnboardingMessage } from "@/lib/onboarding-bot";

/**
 * ==============================================================================
 * Next.js API Route: /api/chat
 * Issue: [BE-27] [P1] [L] Chatbot de onboarding e FAQ (US02) #47
 *
 * PURPOSE:
 * Serves as the primary/gateway chat endpoint for PulseBot (Onboarding Assistant & FAQ).
 * - Proxies to the Supabase Edge Function 'onboarding-chat' if available.
 * - Seamlessly processes requests via the local LLM & documentation knowledge base
 *   if the Edge Function is offline or during local Next.js development.
 *
 * CRITÉRIOS DE ACEITAÇÃO:
 * 1. Endpoint de chat com contexto da documentação do produto
 * 2. Guia a ligação ao GitHub, o mapeamento de colunas e a criação do 1º cliente
 * 3. Valida que a ligação ao GitHub funciona antes de avançar
 * 4. Recusa perguntas fora do âmbito
 * ==============================================================================
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { message, conversation_history, pat_token, is_connected, connected_username } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Mensagem obrigatória no corpo do pedido." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 1. Try Supabase Edge Function if configured
    if (supabaseUrl && anonKey && !supabaseUrl.includes("your-project-ref")) {
      try {
        const edgeFunctionUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/onboarding-chat`;

        const response = await fetch(edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": request.headers.get("Authorization") || `Bearer ${anonKey}`,
            "apikey": anonKey,
          },
          body: JSON.stringify({
            message,
            conversation_history,
            pat_token,
            is_connected,
            connected_username,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        }
      } catch {
        // Fall through to local onboarding-bot engine
      }
    }

    // 2. Process directly via local LLM & documentation knowledge engine
    const result = await processOnboardingMessage({
      message,
      conversation_history,
      pat_token,
      is_connected,
      connected_username,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno no chatbot.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

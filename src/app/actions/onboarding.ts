"use server";

import { invokeEdgeFunction } from "@/lib/edge";

export interface OnboardingChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface OnboardingChatResponse {
  reply: string;
  action_detected?: {
    action: string;
    data?: Record<string, unknown>;
  } | null;
  github_status?: {
    is_connected: boolean;
    username: string | null;
  };
}

/**
 * Server action to send a user message and conversation history to the onboarding-chat Edge Function.
 */
export async function sendOnboardingMessageAction(
  message: string,
  conversationHistory: OnboardingChatMessage[]
): Promise<
  | { success: true; data: OnboardingChatResponse }
  | { success: false; error: string }
> {
  try {
    const res = await invokeEdgeFunction<OnboardingChatResponse>(
      "onboarding-chat",
      {
        message,
        conversation_history: conversationHistory,
      }
    );
    return { success: true, data: res };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Erro ao comunicar com o assistente.";
    return { success: false, error: errorMsg };
  }
}

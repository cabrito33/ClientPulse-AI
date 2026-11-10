"use server";

import { revalidatePath } from "next/cache";
import { approveAndSend, resendReport } from "@/lib/api";

/**
 * Server Action to approve and send a report.
 * Revalidates the dashboard and report review page paths.
 */
export async function approveAndSendAction(id: string, editedBody: string) {
  try {
    const report = await approveAndSend(id, editedBody);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/reports/${id}`);
    return { success: true as const, report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao aprovar e enviar relatório";
    return { success: false as const, error: message };
  }
}

/**
 * Server Action to manually resend a failed report.
 * Revalidates the dashboard and report review page paths.
 */
export async function resendReportAction(id: string) {
  try {
    const report = await resendReport(id);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/reports/${id}`);
    return { success: true as const, report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao reenviar relatório";
    return { success: false as const, error: message };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import {
  approveAndSend,
  resendReport,
  generateReportOnDemand,
  updateClientColumnMapping,
  updateClientAutoSend,
  renewClientPortalToken,
} from "@/lib/api";

/**
 * Server Action to approve and send a report via the approve-and-send Edge Function.
 * Dispatches the email with portal link via Resend.
 */
export async function approveAndSendAction(id: string, editedBody: string) {
  try {
    const { report, isMock } = await approveAndSend(id, editedBody);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/reports/${id}`);
    if (report.clientId) {
      revalidatePath(`/dashboard/clients/${report.clientId}`);
    }
    return { success: true as const, report, isMock };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao aprovar e enviar relatório";
    return { success: false as const, error: message };
  }
}

/**
 * Server Action to manually resend a failed report via the approve-and-send Edge Function.
 * Reuses the existing 3 blocks stored in the report.
 */
export async function resendReportAction(id: string) {
  try {
    const { report, isMock } = await resendReport(id);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/reports/${id}`);
    if (report.clientId) {
      revalidatePath(`/dashboard/clients/${report.clientId}`);
    }
    return { success: true as const, report, isMock };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao reenviar relatório";
    return { success: false as const, error: message };
  }
}

/**
 * Server Action to generate a new report draft on demand for a client.
 * Calls the generate-report Edge Function.
 */
export async function generateReportAction(clientId: string, customNotes?: string) {
  try {
    const { reportId } = await generateReportOnDemand(clientId, customNotes);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/clients/${clientId}`);
    return { success: true as const, reportId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao gerar novo relatório";
    return { success: false as const, error: message };
  }
}

/**
 * Server Action to save column mapping for a client.
 */
export async function saveColumnMappingAction(
  clientId: string,
  columnMapping: Record<string, string[]>,
) {
  try {
    await updateClientColumnMapping(clientId, columnMapping);
    revalidatePath(`/dashboard/clients/${clientId}`);
    return { success: true as const };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao guardar mapeamento de colunas";
    return { success: false as const, error: message };
  }
}

/**
 * Server Action to toggle the auto_send_enabled flag for a client.
 */
export async function toggleAutoSendAction(
  clientId: string,
  autoSendEnabled: boolean,
) {
  try {
    await updateClientAutoSend(clientId, autoSendEnabled);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/clients/${clientId}`);
    return { success: true as const };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar envio automático";
    return { success: false as const, error: message };
  }
}

/**
 * Server Action to renew a client's portal token (BE-19).
 * Revokes current active token and generates a new one.
 */
export async function renewPortalTokenAction(clientId: string) {
  try {
    const result = await renewClientPortalToken(clientId);
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/clients/${clientId}`);
    return {
      success: true as const,
      portalToken: result.portalToken,
      expiresAt: result.expiresAt,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao renovar link do portal";
    return { success: false as const, error: message };
  }
}

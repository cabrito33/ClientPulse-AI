"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { generateReportAction } from "@/app/actions/reports";
import { buttonClass } from "@/components/ui/button";

export function GenerateReportButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateReportAction(clientId);
      if (res.success && res.reportId) {
        router.push(`/dashboard/reports/${res.reportId}`);
      } else {
        setError(res.error || "Não foi possível gerar o relatório.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        className={buttonClass("primary", "sm")}
      >
        {isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>A gerar rascunho com IA...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Gerar relatório agora</span>
          </>
        )}
      </button>
      <span className="text-[10.5px] text-muted-soft">
        Síntese por IA (Google Gemini) · Apenas metadados
      </span>
      {error && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-accent">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

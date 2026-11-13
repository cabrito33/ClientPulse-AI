"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toggleAutoSendAction } from "@/app/actions/reports";
import { cn } from "@/lib/utils";

interface ClientAutoSendToggleProps {
  clientId: string;
  initialAutoSend: boolean;
}

export function ClientAutoSendToggle({
  clientId,
  initialAutoSend,
}: ClientAutoSendToggleProps) {
  const [autoSend, setAutoSend] = useState(initialAutoSend);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const nextVal = !autoSend;
    setAutoSend(nextVal);
    setError(null);

    startTransition(async () => {
      const res = await toggleAutoSendAction(clientId, nextVal);
      if (!res.success) {
        setAutoSend(!nextVal); // Reverter em caso de falha
        setError(res.error || "Erro ao atualizar configuração de envio automático.");
      }
    });
  }

  return (
    <div className="pt-2 border-t border-line/60">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-muted">Envio automático</dt>
        <dd className="flex items-center gap-2">
          {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted" aria-hidden="true" />}
          <button
            type="button"
            role="switch"
            aria-checked={autoSend}
            disabled={isPending}
            onClick={handleToggle}
            aria-label="Alternar envio automático (bypass vs aprovação)"
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full border transition-colors focus:outline-hidden",
              autoSend ? "border-accent bg-accent" : "border-line-strong bg-sand",
              isPending && "opacity-60 cursor-not-allowed",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-all",
                autoSend ? "left-[18px]" : "left-0.5",
              )}
            />
          </button>
          <span className="font-medium text-ink-soft text-xs">
            {autoSend ? "Ligado (bypass)" : "Desligado (requer aprovação)"}
          </span>
        </dd>
      </div>
      <p className="mt-1 text-[11px] text-muted-soft leading-tight">
        {autoSend
          ? "Bypass ativo: relatórios são enviados automaticamente ao cliente sem pausa para revisão."
          : "Aprovação ativa: relatórios ficam no estado 'Pendente de revisão' para validação prévia."}
      </p>
      {error && (
        <p className="mt-1 text-[11px] text-accent font-medium">{error}</p>
      )}
    </div>
  );
}

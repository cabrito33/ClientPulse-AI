"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Check, AlertCircle } from "lucide-react";
import { renewPortalTokenAction } from "@/app/actions/reports";
import { buttonClass } from "@/components/ui/button";

interface RenewPortalLinkButtonProps {
  clientId: string;
}

export function RenewPortalLinkButton({ clientId }: RenewPortalLinkButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleRenew() {
    setError(null);
    setSuccess(false);

    const confirmed = window.confirm(
      "Tem a certeza que deseja renovar o link do portal?\n\nO link anterior será revogado imediatamente e deixará de funcionar. Será gerado um novo link válido por 90 dias.",
    );

    if (!confirmed) return;

    startTransition(async () => {
      const res = await renewPortalTokenAction(clientId);
      if (res.success) {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(res.error || "Não foi possível renovar o link do portal.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleRenew}
        disabled={isPending}
        className={buttonClass("secondary", "sm")}
        title="Revoga o token atual e gera um novo link de 90 dias"
      >
        {isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>A renovar link...</span>
          </>
        ) : success ? (
          <>
            <Check className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
            <span className="text-teal">Link renovado</span>
          </>
        ) : (
          <>
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Renovar link do portal</span>
          </>
        )}
      </button>

      {error && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-accent">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

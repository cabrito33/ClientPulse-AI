"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // Regista o erro completo na consola para depuração interna, sem expor dados ao utilizador
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <main
      role="alert"
      className="mx-auto flex min-h-[60vh] max-w-[1180px] items-center justify-center px-5 py-12 sm:px-8"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-sm sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft/40 text-accent">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>

        <h1 className="mt-4 text-base font-semibold text-ink sm:text-lg">
          Não foi possível carregar o dashboard
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
          Ocorreu uma dificuldade temporária ao obter os dados do teu painel.
          Por favor tenta carregar novamente.
        </p>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className={buttonClass("primary", "md")}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Tentar de novo
          </button>
        </div>
      </div>
    </main>
  );
}

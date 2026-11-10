"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2, Check } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { resendReportAction } from "@/app/actions/reports";
import { cn } from "@/lib/utils";
import type { Report } from "@/data/types";

interface ResendButtonProps {
  reportId: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  label?: string;
  className?: string;
  onSuccess?: (report: Report) => void;
}

export function ResendButton({
  reportId,
  variant = "primary",
  size = "sm",
  label = "Reenviar",
  className,
  onSuccess,
}: ResendButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleResend(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);

    startTransition(async () => {
      const result = await resendReportAction(reportId);
      if (result.success) {
        setSuccess(true);
        if (onSuccess && result.report) {
          onSuccess(result.report);
        }
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleResend}
        disabled={isPending || success}
        className={cn(buttonClass(variant, size), className)}
        title={error ? `Erro: ${error}` : "Reenviar este relatório manualmente"}
      >
        {isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>A reenviar...</span>
          </>
        ) : success ? (
          <>
            <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
            <span>Reenviado!</span>
          </>
        ) : (
          <>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{label}</span>
          </>
        )}
      </button>
      {error && (
        <span className="mt-1 text-[11px] text-accent font-medium">
          {error}
        </span>
      )}
    </div>
  );
}

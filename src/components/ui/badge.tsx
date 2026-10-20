import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "teal" | "gold" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-sand text-ink-soft border-line",
  accent: "bg-accent-soft text-accent-hover border-accent/15",
  teal: "bg-teal-soft text-teal border-teal/15",
  gold: "bg-gold-soft text-[#8a5c00] border-gold/30",
  muted: "bg-paper text-muted border-line",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium leading-5",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "accent" && "bg-accent",
            tone === "teal" && "bg-teal",
            tone === "gold" && "bg-gold",
            (tone === "neutral" || tone === "muted") && "bg-muted-soft",
          )}
        />
      )}
      {children}
    </span>
  );
}

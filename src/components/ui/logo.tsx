import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  inverted = false,
  href = "/",
}: {
  className?: string;
  inverted?: boolean;
  href?: string | null;
}) {
  const mark = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "relative grid h-8 w-8 place-items-center rounded-[10px] shadow-sm",
          inverted ? "bg-paper text-ink" : "bg-ink text-paper",
        )}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
          {/* pulse line inside a rounded square */}
          <path
            d="M4 13.5h3.2l2-5 2.6 9 2.3-6.5 1.6 2.5H20"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-paper" />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[17px] font-semibold tracking-tight">ClientPulse</span>
        <span className="rounded-[5px] bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
          AI
        </span>
      </span>
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} aria-label="ClientPulse AI — página inicial" className="rounded-md">
      {mark}
    </Link>
  );
}

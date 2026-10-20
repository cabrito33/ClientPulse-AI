import { Check, Sparkles, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Static visual of a weekly report, used in the landing hero and elsewhere.
 * Pure presentational component — no data fetching.
 */
export function ReportMockup({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden="true">
      {/* floating email chip */}
      <div className="absolute -left-4 top-10 z-10 hidden w-[210px] rounded-xl border border-line bg-surface p-3 shadow-float sm:block lg:-left-10">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-soft text-teal">
            <Check className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-ink">Relatório enviado</p>
            <p className="truncate text-[10.5px] text-muted">joana@ateliermira.pt</p>
          </div>
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-muted">
          «Obrigada, já percebi em que ponto estamos. Não precisam de reunião esta semana.»
        </p>
      </div>

      {/* float chip right */}
      <div className="absolute -right-3 bottom-14 z-10 hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 shadow-float sm:flex lg:-right-8">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] font-medium text-ink">Gerado em 4 s</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-float">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-line bg-sand/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f0b4a8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f3d9a4]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#b9d8c6]" />
          <p className="ml-2 truncate text-[11px] text-muted">
            clientpulse.ai / relatório · semana 42
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-soft">
                Relatório semanal · Atelier Mira
              </p>
              <h3 className="font-display mt-1.5 text-[22px] leading-tight text-ink sm:text-[25px]">
                Semana 42 — a casa está a ganhar forma
              </h3>
            </div>
            <span className="shrink-0 rounded-full bg-gold-soft px-2.5 py-1 text-[10px] font-semibold text-[#8a5c00]">
              Rascunho IA
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              { k: "Concluídas", v: "7" },
              { k: "Em curso", v: "2" },
              { k: "Bloqueios", v: "1" },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-line bg-paper/70 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-soft">{s.k}</p>
                <p className="mt-0.5 text-lg font-semibold text-ink">{s.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <MockBlock tone="done" title="O que foi feito" items={["Página inicial e versão móvel", "Formulário de contacto ligado"]} />
            <MockBlock tone="block" title="Bloqueios" items={["Fotografias finais de 2 projetos"]} />
            <MockBlock tone="next" title="Próximos passos" items={["Pré-visualização na segunda-feira"]} />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-ink px-3.5 py-2.5">
            <span className="text-[11.5px] font-medium text-paper">Aprovar e enviar ao cliente</span>
            <ArrowUpRight className="h-4 w-4 text-paper/70" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockBlock({
  tone,
  title,
  items,
}: {
  tone: "done" | "block" | "next";
  title: string;
  items: string[];
}) {
  const dot = {
    done: "bg-teal",
    block: "bg-accent",
    next: "bg-gold",
  }[tone];
  return (
    <div className="rounded-lg border border-line/80 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {title}
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.map((i) => (
          <li key={i} className="truncate text-[11.5px] text-ink-soft">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

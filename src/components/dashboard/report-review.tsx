"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Eye,
  Mail,
  RotateCcw,
  Undo2,
  Bot,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { Client, Report, ReportSection } from "@/data/types";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { parseBodyToSections } from "@/lib/report-utils";
import { approveAndSendAction, resendReportAction } from "@/app/actions/reports";

/** Parses edited markdown, falling back to the stored sections. */
function parseBodyFallback(body: string, fallback: ReportSection): ReportSection {
  return parseBodyToSections(body) ?? fallback;
}

type SendState = "pending" | "sent" | "failed";

const headings = {
  done: "## O que foi feito",
  blocks: "## Bloqueios e pontos de atenção",
  next: "## Próximos passos e decisões",
};

export function ReportReview({
  report,
  client,
  sprintMetrics,
}: {
  report: Report;
  client: Client;
  sprintMetrics: { sprint: string; completed: number }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState(report.body);
  const [state, setState] = useState<SendState>(
    report.status === "sent" ? "sent" : report.status === "failed" ? "failed" : "pending"
  );
  const [autoSend, setAutoSend] = useState(client.autoSend);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(report.errorMessage ?? null);
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo<ReportSection>(() => parseBodyFallback(body, report.sections), [body, report.sections]);
  const dirty = body !== report.body;
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;

  function currentIntro(): string {
    const rawIntro = body.split("## O que foi feito")[0]?.trim();
    return rawIntro || report.intro;
  }

  function updateSection(key: keyof ReportSection, index: number, value: string) {
    const next = { ...parsed, [key]: parsed[key].map((v, i) => (i === index ? value : v)) };
    setBody(serialize(next, currentIntro()));
  }

  function addItem(key: keyof ReportSection) {
    const next = { ...parsed, [key]: [...parsed[key], ""] };
    setBody(serialize(next, currentIntro()));
  }

  function removeItem(key: keyof ReportSection, index: number) {
    const next = { ...parsed, [key]: parsed[key].filter((_, i) => i !== index) };
    setBody(serialize(next, currentIntro()));
  }

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approveAndSendAction(report.id, body);
      if (result.success) {
        setState("sent");
        setToast(`Relatório aprovado e enviado para ${client.email}`);
        router.refresh();
      } else {
        setState("failed");
        setError(result.error);
      }
    });
  }

  function handleResend() {
    setError(null);
    startTransition(async () => {
      const result = await resendReportAction(report.id);
      if (result.success) {
        setState("sent");
        setToast(`Relatório reenviado com sucesso para ${client.email}!`);
        router.refresh();
      } else {
        setState("failed");
        setError(result.error);
      }
    });
  }

  function approveWithCopy() {
    setState("sent");
    setToast(`Relatório aprovado — registo guardado. E-mail simulado para ${client.email}.`);
    startTransition(() => router.refresh());
  }

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-7 sm:px-8">
      <nav aria-label="Migalhas" className="flex items-center gap-1.5 text-[12px] text-muted">
        <Link href="/dashboard" className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Dashboard
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-ink-soft">{client.name}</span>
        <span aria-hidden="true">/</span>
        <span className="truncate">{report.weekLabel}</span>
      </nav>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[26px] leading-tight text-ink sm:text-[30px]">
              Rever relatório
            </h1>
            {state === "sent" ? (
              <Badge tone="teal" dot>
                Enviado
              </Badge>
            ) : state === "failed" ? (
              <Badge tone="accent" dot>
                Falha no envio
              </Badge>
            ) : (
              <Badge tone="gold" dot>
                Aguarda aprovação
              </Badge>
            )}
            {report.generatedWithoutAi && (
              <Badge tone="accent" dot>
                Gerado sem IA — rever manualmente
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[13.5px] text-muted">
            {client.name} · {report.weekLabel} ·{" "}
            {report.generatedWithoutAi
              ? "gerado a partir de tarefas em bruto (sem IA)"
              : "gerado por IA"}{" "}
            a {formatDateTime(report.generatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/portal/${client.portalToken}`} className={buttonClass("ghost", "sm")}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Ver como o cliente
          </Link>
          <button
            type="button"
            onClick={() => setBody(report.body)}
            disabled={!dirty || isPending}
            className={buttonClass("secondary", "sm")}
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            Descartar edições
          </button>
          {state === "failed" ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={isPending}
              className={buttonClass("primary", "sm")}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  A reenviar...
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reenviar relatório
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={approve}
              disabled={state === "sent" || isPending}
              className={buttonClass("primary", "sm")}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  A enviar...
                </>
              ) : state === "sent" ? (
                <>
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Enviado
                </>
              ) : (
                <>
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Aprovar e enviar
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {report.generatedWithoutAi && (
        <div
          role="alert"
          aria-label="Aviso de geração sem IA"
          className="mt-5 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft/50 px-4 py-3 text-[13px] text-ink"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-accent-hover">Gerado sem IA — rever manualmente</p>
            <p className="mt-0.5 text-[12px] text-muted">
              Não foi possível obter síntese automática através da IA. Os cartões de tarefas do GitHub foram agrupados diretamente em bruto para que possa rever e ajustar os blocos antes do envio.
            </p>
          </div>
        </div>
      )}

      {state === "failed" && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft/70 px-4 py-3 text-[13px] text-ink"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-accent-hover">Falha no envio do relatório</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {error || "Ocorreu um erro no serviço de envio de e-mails. Podes reenviar manualmente clicando no botão ao lado."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleResend}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-accent-hover transition-colors shrink-0"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Reenviar agora
          </button>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="mt-5 flex items-start gap-3 rounded-xl border border-teal/25 bg-teal-soft/70 px-4 py-3 text-[13px] text-teal"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">{toast}</p>
            <p className="mt-0.5 text-[11.5px] text-teal/80">
              Envio simulado — nenhum e-mail real foi enviado neste protótipo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[11px] underline underline-offset-2"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* editor */}
        <div className="min-w-0">
          <section className="rounded-2xl border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent" aria-hidden="true" />
                <h2 className="text-[13.5px] font-semibold text-ink">Rascunho gerado por IA</h2>
                <Badge tone="accent">Editável</Badge>
              </div>
              <p className="text-[11px] text-muted-soft">
                {wordCount} palavras {dirty && <span className="text-accent">· editado</span>}
              </p>
            </div>

            <div className="px-5 py-4">
              <label htmlFor="report-subject" className="text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
                Assunto do e-mail
              </label>
              <input
                id="report-subject"
                type="text"
                defaultValue={report.subject}
                disabled={state === "sent"}
                className="mt-1.5 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-[13.5px] text-ink outline-none focus:border-accent/60 focus:bg-surface disabled:opacity-70"
              />
            </div>

            <fieldset disabled={state === "sent"} className="space-y-5 border-t border-line p-5 disabled:opacity-80">
              <legend className="sr-only">Três blocos obrigatórios do relatório</legend>
              <BlockEditor
                tone="done"
                title="O que foi feito"
                hint="Conquistas em linguagem de negócio."
                items={parsed.done}
                onChange={(i, v) => updateSection("done", i, v)}
                onAdd={() => addItem("done")}
                onRemove={(i) => removeItem("done", i)}
              />
              <BlockEditor
                tone="block"
                title="Bloqueios e pontos de atenção"
                hint="O que impede o progresso e o que precisas do cliente."
                items={parsed.blocks}
                onChange={(i, v) => updateSection("blocks", i, v)}
                onAdd={() => addItem("blocks")}
                onRemove={(i) => removeItem("blocks", i)}
              />
              <BlockEditor
                tone="next"
                title="Próximos passos e decisões"
                hint="O que acontece a seguir e o que é preciso decidir."
                items={parsed.next}
                onChange={(i, v) => updateSection("next", i, v)}
                onAdd={() => addItem("next")}
                onRemove={(i) => removeItem("next", i)}
              />
            </fieldset>
          </section>

          <details className="mt-4 rounded-2xl border border-line bg-surface px-5 py-4">
            <summary className="cursor-pointer text-[12.5px] font-medium text-ink-soft">
              Ver texto integral (Markdown)
            </summary>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={state === "sent"}
              rows={16}
              spellCheck={false}
              className="scroll-thin mt-3 w-full resize-y rounded-lg border border-line bg-paper/60 p-3 font-mono text-[12px] leading-relaxed text-ink-soft outline-none focus:border-accent/60 disabled:opacity-70"
              aria-label="Texto integral do relatório em Markdown"
            />
            <p className="mt-2 text-[11px] text-muted-soft">
              As alterações aqui são refletidas nos três blocos acima.
            </p>
          </details>
        </div>

        {/* side panel */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-soft">
              Envio automático
            </h2>
            <div className="mt-3 flex items-start justify-between gap-3">
              <p className="text-[12.5px] leading-relaxed text-muted">
                Enviar sem aprovação sempre que o rascunho for gerado.
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={autoSend}
                aria-label="Envio automático sem aprovação"
                onClick={() => setAutoSend((v) => !v)}
                className={cn(
                  "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors",
                  autoSend ? "border-accent bg-accent" : "border-line-strong bg-sand",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-all",
                    autoSend ? "left-[22px]" : "left-0.5",
                  )}
                  style={{ height: 18, width: 18 }}
                />
              </button>
            </div>
            <p
              className={cn(
                "mt-3 rounded-lg px-2.5 py-2 text-[11px] leading-snug",
                autoSend ? "bg-gold-soft text-[#6d4a00]" : "bg-sand text-muted",
              )}
            >
              {autoSend
                ? "Ligado: os próximos relatórios deste cliente seguem sem revisão. Esta alteração é apenas visual no protótipo."
                : "Desligado: cada rascunho espera pela tua aprovação. Recomendado."}
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-soft">
              Contexto da IA
            </h2>
            <dl className="mt-3 space-y-2.5 text-[12.5px]">
              <Row k="Fonte" v="GitHub Projects" />
              <Row k="Tarefas lidas" v={`${report.tasksCompleted + (report.tasksPlanned - report.tasksCompleted)} cartões`} />
              <Row k="Concluídas" v={`${report.tasksCompleted} de ${report.tasksPlanned}`} />
              <Row k="Idioma · tom" v={client.language === "pt" ? "PT · Executivo" : "EN · Executive"} />
            </dl>
            <div className="mt-4 rounded-lg bg-paper p-3">
              <p className="text-[11px] font-medium text-ink-soft">Só metadados</p>
              <p className="mt-1 text-[11px] leading-snug text-muted">
                Títulos, estados e etiquetas. Nenhum ficheiro ou linha de código é lido.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-soft">
              Ritmo recente
            </h2>
            <div className="mt-3 flex items-end gap-1.5" aria-hidden="true">
              {sprintMetrics.slice(-6).map((m) => {
                const max = Math.max(...sprintMetrics.map((x) => x.completed), 1);
                return (
                  <div key={m.sprint} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-teal/80"
                      style={{ height: `${Math.max(6, (m.completed / max) * 56)}px` }}
                    />
                    <span className="text-[9px] text-muted-soft">{m.sprint}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted">
              Tarefas concluídas por sprint, para dar contexto ao texto.
            </p>
          </section>

          <div className="rounded-2xl border border-dashed border-line-strong/70 p-4 text-center">
            <button
              type="button"
              onClick={approveWithCopy}
              disabled={state === "sent"}
              className="text-[11.5px] font-medium text-muted hover:text-ink disabled:opacity-40"
            >
              <RotateCcw className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Simular envio sem alterações
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-ink-soft">{v}</dd>
    </div>
  );
}

function BlockEditor({
  tone,
  title,
  hint,
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  tone: "done" | "block" | "next";
  title: string;
  hint: string;
  items: string[];
  onChange: (i: number, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  const accent = {
    done: "border-teal/30 bg-teal-soft/40",
    block: "border-accent/25 bg-accent-soft/40",
    next: "border-gold/35 bg-gold-soft/40",
  }[tone];
  const dot = { done: "bg-teal", block: "bg-accent", next: "bg-gold" }[tone];

  return (
    <div className={cn("rounded-xl border p-4", accent)}>
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
          <p className="text-[11px] text-muted">{hint}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="group flex items-center gap-1.5">
            <span aria-hidden="true" className="text-[11px] text-muted-soft">•</span>
            <input
              type="text"
              value={item}
              onChange={(e) => onChange(i, e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-ink outline-none transition-colors hover:border-line focus:border-accent/50 focus:bg-surface"
              aria-label={`${title} — item ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="rounded p-1 text-[11px] text-muted-soft opacity-70 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0"
              aria-label={`Remover item ${i + 1} de ${title}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:text-accent"
      >
        + Adicionar linha
      </button>
    </div>
  );
}

function serialize(s: ReportSection, intro?: string): string {
  const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  const blocks = [
    "## O que foi feito",
    bullets(s.done),
    "",
    headings.blocks,
    bullets(s.blocks),
    "",
    headings.next,
    bullets(s.next),
  ];
  if (intro) {
    return [intro, "", ...blocks].join("\n");
  }
  return blocks.join("\n");
}

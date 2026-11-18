"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
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
  ShieldCheck,
  Copy,
  ExternalLink,
  X,
  Info,
} from "lucide-react";
import type { Client, Report, ReportSection } from "@/data/types";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { parseBodyToSections, serializeReportSections } from "@/lib/report-utils";
import {
  approveAndSendAction,
  resendReportAction,
  toggleAutoSendAction,
  trackReportReviewOpenedAction,
} from "@/app/actions/reports";

/** Parses edited markdown, falling back to the stored sections. */
function parseBodyFallback(body: string, fallback: ReportSection): ReportSection {
  return parseBodyToSections(body) ?? fallback;
}

type SendState = "pending" | "sent" | "failed";

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
  const [sections, setSections] = useState<ReportSection>(() => {
    const raw = parseBodyFallback(report.body, report.sections);
    const cleanList = (list: string[]) =>
      list.map((i) => i.replace(/^(\s*[-*•◦▪]\s*)+/, "").trim()).filter(Boolean);
    return {
      done: cleanList(raw.done),
      blocks: cleanList(raw.blocks),
      next: cleanList(raw.next),
    };
  });
  const [state, setState] = useState<SendState>(
    report.status === "sent" ? "sent" : report.status === "failed" ? "failed" : "pending"
  );
  const [autoSend, setAutoSend] = useState(client.autoSend);
  const [isUpdatingAutoSend, setIsUpdatingAutoSend] = useState(false);
  const [toast, setToast] = useState<{ title: string; subtitle: string } | null>(null);
  const [error, setError] = useState<string | null>(report.errorMessage ?? null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Close demo modal on Escape
  useEffect(() => {
    if (!showEmailModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowEmailModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showEmailModal]);

  // Record review_opened_at on mount if not yet set
  useEffect(() => {
    if (!report.reviewOpenedAt) {
      trackReportReviewOpenedAction(report.id);
    }
  }, [report.id, report.reviewOpenedAt]);

  const dirty = body !== report.body;
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;

  function currentIntro(): string {
    const rawIntro = body.split("## O que foi feito")[0]?.trim();
    return rawIntro || report.intro;
  }

  function updateSection(key: keyof ReportSection, index: number, value: string) {
    const next = { ...sections, [key]: sections[key].map((v, i) => (i === index ? value : v)) };
    setSections(next);
    setBody(serializeReportSections(next, currentIntro()));
  }

  function addItem(key: keyof ReportSection) {
    const next = { ...sections, [key]: [...sections[key], ""] };
    setSections(next);
    setBody(serializeReportSections(next, currentIntro()));
  }

  function removeItem(key: keyof ReportSection, index: number) {
    const next = { ...sections, [key]: sections[key].filter((_, i) => i !== index) };
    setSections(next);
    setBody(serializeReportSections(next, currentIntro()));
  }

  function handleDiscard() {
    setBody(report.body);
    const raw = parseBodyFallback(report.body, report.sections);
    const cleanList = (list: string[]) =>
      list.map((i) => i.replace(/^(\s*[-*•◦▪]\s*)+/, "").trim()).filter(Boolean);
    setSections({
      done: cleanList(raw.done),
      blocks: cleanList(raw.blocks),
      next: cleanList(raw.next),
    });
  }

  function approve() {
    const hasNoTasks =
      (report.tasksPlanned === 0 && report.tasksCompleted === 0) ||
      (sections.done.length === 0 && sections.blocks.length === 0 && sections.next.length === 0);

    if (hasNoTasks) {
      const confirmed = window.confirm("Este relatório não tem tarefas. Enviar mesmo assim?");
      if (!confirmed) return;
    }

    setError(null);
    startTransition(async () => {
      const result = await approveAndSendAction(report.id, body);
      if (result.success) {
        setState("sent");
        if (result.isMock) {
          setToast({
            title: `Relatório aprovado (${client.email})`,
            subtitle:
              "Relatório aprovado com sucesso! Modo de avaliação/demonstração: link do portal seguro gerado e ativo.",
          });
        } else {
          setToast({
            title: `Relatório aprovado e enviado para ${client.email}`,
            subtitle: "E-mail enviado com sucesso, com o link do portal.",
          });
        }
        setShowEmailModal(true);
        router.refresh();
      } else {
        setState("failed");
        setError(result.error);
        if (
          result.error?.includes("Resend só permite") ||
          result.error?.includes("domínio") ||
          result.error?.includes("sandbox") ||
          result.error?.includes("testing emails")
        ) {
          setShowEmailModal(true);
        }
      }
    });
  }

  function handleResend() {
    setError(null);
    startTransition(async () => {
      const result = await resendReportAction(report.id);
      if (result.success) {
        setState("sent");
        if (result.isMock) {
          setToast({
            title: `Relatório reenviado (${client.email})`,
            subtitle:
              "Relatório aprovado com sucesso! Modo de avaliação/demonstração: link do portal seguro gerado e ativo.",
          });
        } else {
          setToast({
            title: `Relatório reenviado com sucesso para ${client.email}`,
            subtitle: "E-mail enviado com sucesso, com o link do portal.",
          });
        }
        setShowEmailModal(true);
        router.refresh();
      } else {
        setState("failed");
        setError(result.error);
        if (
          result.error?.includes("Resend só permite") ||
          result.error?.includes("domínio") ||
          result.error?.includes("sandbox") ||
          result.error?.includes("testing emails")
        ) {
          setShowEmailModal(true);
        }
      }
    });
  }

  async function handleToggleAutoSend() {
    const nextVal = !autoSend;
    setAutoSend(nextVal);
    setIsUpdatingAutoSend(true);
    try {
      const res = await toggleAutoSendAction(client.id, nextVal);
      if (!res.success) {
        setAutoSend(!nextVal); // Reverter se falhar
        setError(res.error);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setAutoSend(!nextVal);
      setError(err instanceof Error ? err.message : "Erro ao alterar envio automático.");
    } finally {
      setIsUpdatingAutoSend(false);
    }
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
              <>
                <Badge tone="teal" dot>
                  Enviado
                </Badge>
                {report.openedAt ? (
                  <Badge tone="teal">
                    Aberto pelo cliente
                  </Badge>
                ) : (
                  <Badge tone="muted">
                    Ainda não aberto
                  </Badge>
                )}
              </>
            ) : state === "failed" ? (
              <Badge tone="accent" dot>
                Falha no envio
              </Badge>
            ) : (
              <Badge tone="gold" dot>
                Pendente de revisão
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
            {report.sentAt && ` · enviado a ${formatDateTime(report.sentAt)}`}
            {report.openedAt && ` · aberto pelo cliente a ${formatDateTime(report.openedAt)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/portal/${client.portalToken}`} className={buttonClass("ghost", "sm")}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Ver como o cliente
          </Link>
          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className={buttonClass("ghost", "sm")}
            title="Ver detalhes de entrega e acesso ao portal"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Info de entrega
          </button>
          <button
            type="button"
            onClick={handleDiscard}
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

      {!report.generatedWithoutAi && (
        <div
          role="region"
          aria-label="Aviso de privacidade e inteligência artificial"
          className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-surface/80 px-4 py-3 text-[13px] text-ink"
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex-1 text-[12px] leading-relaxed text-muted">
            <p className="font-semibold text-ink flex items-center gap-1.5">
              <span>Síntese gerada por IA externa (Google Gemini)</span>
              <span className="inline-flex items-center rounded-md bg-paper px-1.5 py-0.5 text-[10px] font-medium text-muted-soft border border-line">
                Minimização de Dados
              </span>
            </p>
            <p className="mt-0.5">
              A IA recebe metadados das tarefas, contexto do cliente e notas do gestor. A integração não lê ficheiros de código. Evita dados sensíveis nos campos de texto e revê os blocos antes de aprovar: a IA pode cometer imprecisões.
            </p>
          </div>
        </div>
      )}

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

      {report.unmappedColumns && report.unmappedColumns.length > 0 && (
        <div
          role="note"
          aria-label="Aviso de colunas não mapeadas"
          className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-ink"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="flex-1 text-[12px] leading-relaxed text-muted">
            <p className="font-semibold text-ink">
              Colunas não mapeadas ignoradas neste relatório ({report.unmappedColumns.length})
            </p>
            <p className="mt-0.5">
              As seguintes colunas do board do GitHub não estão mapeadas: <span className="font-medium text-ink">{report.unmappedColumns.join(", ")}</span>.
              {report.ignoredTasksCount !== undefined && report.ignoredTasksCount > 0 ? (
                <> Foram excluídas {report.ignoredTasksCount} tarefas que não pertencem a nenhuma das 3 categorias do relatório.</>
              ) : (
                <> As tarefas nestas colunas foram excluídas e não constam no rascunho.</>
              )}
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
              {error || "O envio falhou. Tenta de novo e, se continuar, verifica o e-mail do cliente"}
            </p>
            {error?.includes("Resend só permite enviar para o e-mail da tua conta") && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-xs hover:bg-accent-hover transition-colors cursor-pointer"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  Por que não recebi o e-mail? / Aceder ao portal
                </button>
              </div>
            )}
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
            <p className="font-medium">{toast.title}</p>
            <p className="mt-0.5 text-[11.5px] text-teal/80">
              {toast.subtitle}
            </p>
            <div className="mt-1.5">
              <button
                type="button"
                onClick={() => setShowEmailModal(true)}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium underline underline-offset-2 hover:text-teal-hover cursor-pointer"
              >
                <Info className="h-3 w-3" />
                Por que o e-mail não chega à caixa de entrada? (Ver detalhes)
              </button>
            </div>
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
                items={sections.done}
                onChange={(i, v) => updateSection("done", i, v)}
                onAdd={() => addItem("done")}
                onRemove={(i) => removeItem("done", i)}
              />
              <BlockEditor
                tone="block"
                title="Bloqueios e pontos de atenção"
                hint="O que impede o progresso e o que precisas do cliente."
                items={sections.blocks}
                onChange={(i, v) => updateSection("blocks", i, v)}
                onAdd={() => addItem("blocks")}
                onRemove={(i) => removeItem("blocks", i)}
              />
              <BlockEditor
                tone="next"
                title="Próximos passos e decisões"
                hint="O que acontece a seguir e o que é preciso decidir."
                items={sections.next}
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
              onChange={(e) => {
                const nextBody = e.target.value;
                setBody(nextBody);
                const parsedFromRaw = parseBodyToSections(nextBody);
                if (parsedFromRaw) {
                  setSections(parsedFromRaw);
                }
              }}
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
                disabled={isUpdatingAutoSend}
                aria-label="Envio automático sem aprovação"
                onClick={handleToggleAutoSend}
                className={cn(
                  "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors",
                  autoSend ? "border-accent bg-accent" : "border-line-strong bg-sand",
                  isUpdatingAutoSend && "opacity-60 cursor-not-allowed",
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
                ? "Ligado: os próximos relatórios deste cliente seguem sem revisão."
                : "Desligado: cada rascunho espera pela tua aprovação. Recomendado."}
            </p>
          </section>

          {state === "sent" && (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-soft">
                Estado de Envio e Abertura
              </h2>
              <dl className="mt-3 space-y-2.5 text-[12.5px]">
                <Row k="Estado" v="Enviado ao cliente" />
                {report.sentAt && <Row k="Data de envio" v={formatDateTime(report.sentAt)} />}
                <Row
                  k="Primeira abertura"
                  v={report.openedAt ? formatDateTime(report.openedAt) : "Ainda não aberto"}
                />
              </dl>
              <div className="mt-3.5 rounded-lg bg-paper p-3 text-[11px] text-muted leading-relaxed">
                {report.openedAt ? (
                  <p className="text-teal font-medium">
                    ✓ O cliente abriu o relatório via e-mail ou portal.
                  </p>
                ) : (
                  <p>
                    O tracking de abertura (pixel ou webhook) registará automaticamente o primeiro acesso do cliente.
                  </p>
                )}
              </div>
            </section>
          )}

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
        </aside>
      </div>

      {/* Pop-up explicativo para o professor e avaliadores */}
      {showEmailModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEmailModal(false);
          }}
        >
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto scroll-thin rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-ink">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="email-modal-title" className="text-[16px] font-semibold text-ink leading-snug">
                    Envio de E-mail — Modo de Demonstração
                  </h2>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <Badge tone="accent">Ambiente Académico / Vercel</Badge>
                    <span>·</span>
                    <span className="truncate max-w-[200px]">{client.email}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-paper hover:text-ink transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="mt-5 space-y-4 text-[13px] leading-relaxed">
              {/* Card 1: Por que não recebes o e-mail na caixa de entrada */}
              <div className="rounded-xl border border-line bg-paper/60 p-4">
                <h3 className="flex items-center gap-1.5 font-semibold text-[13px] text-ink">
                  <Info className="h-4 w-4 text-accent shrink-0" aria-hidden="true" />
                  Por que o e-mail não chega à tua caixa de entrada pessoal?
                </h3>
                <p className="mt-1.5 text-[12px] text-muted">
                  Este projeto está alojado na Vercel (<code className="rounded bg-surface px-1 py-0.5 text-[11px] text-ink font-mono">weekly-client-reports.vercel.app</code>) sob o remetente de teste padrão do Resend (<code className="rounded bg-surface px-1 py-0.5 text-[11px] text-ink font-mono">onboarding@resend.dev</code>).
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Por normas globais de segurança (<strong className="text-ink font-medium">SPF / DKIM / DMARC</strong>) para prevenção de spam e phishing, os fornecedores de e-mail (Gmail, Outlook, servidores universitários) apenas aceitam mensagens para caixas externas se enviadas a partir de um <strong className="text-ink font-medium">domínio próprio verificado por DNS</strong>.
                </p>
              </div>

              {/* Card 2: Como aceder ao que receberias */}
              <div className="rounded-xl border border-teal/30 bg-teal-soft/40 p-4">
                <h3 className="flex items-center gap-1.5 font-semibold text-[13px] text-teal">
                  <ShieldCheck className="h-4 w-4 text-teal shrink-0" aria-hidden="true" />
                  Como aceder ao conteúdo que o cliente receberia?
                </h3>
                <p className="mt-1.5 text-[12px] text-teal/90">
                  O e-mail transacional conteria o resumo executivo dos 3 blocos e a ligação segura (Magic Link) para o <strong className="font-semibold text-teal">Portal do Cliente Zero-Login</strong>.
                </p>
                <p className="mt-1 text-[12px] text-teal/90">
                  Podes aceder diretamente a essa mesma experiência agora, com os dados reais do projeto e sem necessidade de login ou password:
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <a
                    href={`/portal/${client.portalToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-medium text-white shadow-xs hover:bg-teal-hover transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Abrir Portal do Cliente &rarr;
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined" && navigator.clipboard) {
                        const url = `${window.location.origin}/portal/${client.portalToken}`;
                        navigator.clipboard.writeText(url);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal/30 bg-surface px-3 py-2 text-[12px] font-medium text-teal hover:bg-teal-soft transition-colors cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
                        Link copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copiar Magic Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Card 3: Pré-visualização do conteúdo do e-mail */}
              <details className="rounded-xl border border-line bg-paper/40 p-3.5 text-[12px]">
                <summary className="cursor-pointer font-medium text-ink-soft select-none hover:text-ink">
                  Pré-visualização: O que constaria no e-mail
                </summary>
                <div className="mt-3 space-y-2 border-t border-line/60 pt-3 text-[11.5px] text-muted">
                  <div className="flex gap-2">
                    <span className="font-semibold text-ink-soft w-16 shrink-0">De:</span>
                    <span className="truncate">ClientPulse AI &lt;onboarding@resend.dev&gt;</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-ink-soft w-16 shrink-0">Para:</span>
                    <span className="truncate">{client.name} &lt;{client.email}&gt;</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-ink-soft w-16 shrink-0">Assunto:</span>
                    <span className="text-ink font-medium">{report.subject}</span>
                  </div>
                  <div className="mt-2.5 rounded-lg border border-line bg-surface p-3 space-y-2.5">
                    <div>
                      <p className="font-semibold text-ink text-[12px]">✅ O que foi concluído:</p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5 text-ink-soft">
                        {sections.done.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    {sections.blocks.length > 0 && (
                      <div>
                        <p className="font-semibold text-ink text-[12px]">⚠️ Pontos de Atenção & Bloqueios:</p>
                        <ul className="mt-1 list-disc pl-4 space-y-0.5 text-ink-soft">
                          {sections.blocks.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {sections.next.length > 0 && (
                      <div>
                        <p className="font-semibold text-ink text-[12px]">🚀 Próximos Passos & Decisões:</p>
                        <ul className="mt-1 list-disc pl-4 space-y-0.5 text-ink-soft">
                          {sections.next.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>

            {/* Rodapé */}
            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className={buttonClass("primary", "sm")}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
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

function AutoResizeTextarea({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  ariaLabel: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      className="min-w-0 flex-1 resize-none overflow-hidden break-words whitespace-pre-wrap rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] leading-relaxed text-ink outline-none transition-colors hover:border-line focus:border-accent/50 focus:bg-surface"
      aria-label={ariaLabel}
    />
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
          <li key={i} className="group flex items-start gap-1.5">
            <span aria-hidden="true" className="mt-1 text-[11px] text-muted-soft">•</span>
            <AutoResizeTextarea
              value={item}
              onChange={(val) => onChange(i, val)}
              ariaLabel={`${title} — item ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="mt-0.5 rounded p-1 text-[11px] text-muted-soft opacity-70 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0"
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

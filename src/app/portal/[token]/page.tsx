import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, ArrowLeft, Clock, FileText } from "lucide-react";
import { getPortalData, recordReportOpen } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { CompletedBySprintChart } from "@/components/dashboard/charts";
import { formatDate, formatDateTime } from "@/lib/utils";

interface PortalPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PortalPageProps) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) return { title: "Portal não encontrado" };
  return {
    title: `Portal do Cliente — ${data.client.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { token } = await params;
  const data = await getPortalData(token);

  if (!data) {
    notFound();
  }

  const { client, current, history, metrics } = data;

  // Track email/portal view if not already opened (BE-21)
  if (current && !current.openedAt) {
    void recordReportOpen(current.id);
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Top navigation */}
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Logo href={null} />
            <span className="hidden text-muted-soft sm:inline">/</span>
            <span className="hidden text-sm font-medium text-ink-soft sm:inline">
              Portal do Cliente
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="teal" dot>
              Acesso seguro (sem login)
            </Badge>
            <Link
              href="/dashboard"
              className="hidden text-xs text-muted hover:text-ink sm:inline-flex sm:items-center sm:gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Ver dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
        {/* Client Welcome Banner */}
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-sand text-xs font-semibold text-ink-soft">
                  {client.avatarInitials}
                </span>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                  {client.company}
                </p>
              </div>
              <h1 className="font-display mt-2 text-2xl text-ink sm:text-3xl">
                Relatório Semanal de Progresso
              </h1>
              <p className="mt-1 text-sm text-muted">
                Projeto: <strong className="font-medium text-ink-soft">{client.projectName}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-line bg-sand/40 px-3.5 py-2.5 text-xs text-muted">
              <ShieldCheck className="h-4 w-4 text-teal" aria-hidden="true" />
              <span>Link verificado para {client.email}</span>
            </div>
          </div>
        </div>

        {/* Current Report */}
        {current ? (
          <div className="mt-8 space-y-6">
            <section
              aria-labelledby="relatorio-atual"
              className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
            >
              <div className="border-b border-line bg-sand/30 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-teal" />
                    <h2 id="relatorio-atual" className="text-base font-semibold text-ink">
                      {current.weekLabel}
                    </h2>
                    <Badge tone="neutral">
                      {formatDate(current.periodStart)} – {formatDate(current.periodEnd)}
                    </Badge>
                  </div>
                  {current.sentAt && (
                    <p className="text-xs text-muted">
                      Entregue a {formatDateTime(current.sentAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 sm:p-8">
                {/* Intro message */}
                {current.intro && (
                  <p className="text-sm leading-relaxed text-ink-soft">
                    {current.intro}
                  </p>
                )}

                {/* Progress summary card */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-line bg-paper/60 p-3.5">
                    <p className="text-xs uppercase tracking-wide text-muted">Concluídas</p>
                    <p className="font-display mt-1 text-xl text-teal">{current.tasksCompleted}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-paper/60 p-3.5">
                    <p className="text-xs uppercase tracking-wide text-muted">Planeadas</p>
                    <p className="font-display mt-1 text-xl text-ink">{current.tasksPlanned}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-paper/60 p-3.5">
                    <p className="text-xs uppercase tracking-wide text-muted">Taxa de conclusão</p>
                    <p className="font-display mt-1 text-xl text-ink">
                      {Math.round((current.tasksCompleted / Math.max(current.tasksPlanned, 1)) * 100)}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-paper/60 p-3.5">
                    <p className="text-xs uppercase tracking-wide text-muted">Cadência</p>
                    <p className="mt-1 text-sm font-medium text-ink-soft capitalize">
                      {client.frequency === "weekly" ? "Semanal" : client.frequency === "biweekly" ? "Quinzenal" : "Mensal"}
                    </p>
                  </div>
                </div>

                {/* Three structured blocks */}
                <div className="mt-8 space-y-5">
                  {/* Done */}
                  <div className="rounded-xl border border-teal/25 bg-teal-soft/30 p-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-teal">
                      <span className="h-2 w-2 rounded-full bg-teal" />
                      O que foi feito
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                      {current.sections.done.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Blockers */}
                  <div className="rounded-xl border border-accent/20 bg-accent-soft/30 p-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-accent-hover">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      Bloqueios e pontos de atenção
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                      {current.sections.blocks.length > 0 ? (
                        current.sections.blocks.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span>{item}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-muted">Sem bloqueios registados nesta semana.</li>
                      )}
                    </ul>
                  </div>

                  {/* Next steps */}
                  <div className="rounded-xl border border-gold/30 bg-gold-soft/30 p-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#8a5c00]">
                      <span className="h-2 w-2 rounded-full bg-gold" />
                      Próximos passos e decisões
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                      {current.sections.next.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Sprint Velocity Chart */}
            {metrics.length > 0 && (
              <section
                aria-labelledby="ritmo-sprints"
                className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 id="ritmo-sprints" className="text-base font-semibold text-ink">
                      Tarefas concluídas por sprint
                    </h2>
                    <p className="text-xs text-muted">
                      Histórico recente de entregas no GitHub Projects
                    </p>
                  </div>
                  <Badge tone="neutral">Últimos {metrics.length} ciclos</Badge>
                </div>
                <div className="mt-6">
                  <CompletedBySprintChart data={metrics} height={200} />
                </div>
              </section>
            )}

            {/* History of previous reports */}
            {history.length > 1 && (
              <section
                aria-labelledby="historico-relatorios"
                className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
              >
                <h2 id="historico-relatorios" className="text-base font-semibold text-ink">
                  Histórico de relatórios
                </h2>
                <p className="text-xs text-muted">
                  Todos os pontos de situação enviados para este projeto
                </p>

                <div className="mt-4 divide-y divide-line">
                  {history.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-3.5">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-soft" />
                        <div>
                          <p className="text-sm font-medium text-ink">{r.weekLabel}</p>
                          <p className="text-xs text-muted">
                            {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-soft">
                          {r.tasksCompleted} tarefas
                        </span>
                        <Badge tone={r.status === "sent" ? "teal" : "neutral"} dot>
                          {r.status === "sent" ? "Entregue" : "Rascunho"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-soft" />
            <h2 className="mt-3 text-base font-semibold text-ink">Sem relatórios disponíveis</h2>
            <p className="mt-1 text-sm text-muted">
              O primeiro relatório para este projeto será gerado no final do sprint atual.
            </p>
          </div>
        )}

        <footer className="mt-12 border-t border-line pt-6 text-center text-xs text-muted-soft">
          <p>
            ClientPulse AI — Portal exclusivo de visualização para {client.name}.
          </p>
          <p className="mt-1">
            Todos os dados e nomes apresentados nesta página são fictícios para fins de demonstração.
          </p>
        </footer>
      </main>
    </div>
  );
}

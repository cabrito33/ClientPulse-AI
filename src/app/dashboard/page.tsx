import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  FileText,
  CheckCircle2,
  Mail,
  Eye,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { getClients, getDashboardSummary, getReports, getSprintCards, getSprintMetrics } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PlannedVsCompletedChart } from "@/components/dashboard/charts";
import { ResendButton } from "@/components/dashboard/resend-button";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Visão geral" };

function getLisbonGreeting(): string {
  const formatter = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(formatter.format(new Date()), 10);
  if (hour < 12) return "Bom dia";
  if (hour < 20) return "Boa tarde";
  return "Boa noite";
}

function getLisbonFormattedDate(): string {
  const formatter = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return formatter.format(new Date());
}

function getIsoWeekNumber(d: Date = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const statusBadge = {
  pending_approval: { tone: "gold" as const, label: "Pendente de revisão" },
  draft: { tone: "gold" as const, label: "Pendente de revisão" },
  sent: { tone: "teal" as const, label: "Enviado" },
  scheduled: { tone: "neutral" as const, label: "Agendado" },
  failed: { tone: "accent" as const, label: "Falha no envio" },
};

const columnMeta = {
  done: { label: "Concluído", tone: "bg-teal", bg: "bg-teal-soft/50" },
  in_progress: { label: "Em curso", tone: "bg-gold", bg: "bg-gold-soft/50" },
  blocked: { label: "Bloqueado", tone: "bg-accent", bg: "bg-accent-soft/50" },
};

export default async function DashboardPage() {
  const [summary, reports, clients, cards] = await Promise.all([
    getDashboardSummary(),
    getReports(),
    getClients(),
    getSprintCards(),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rawName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    "";

  if (!rawName && user?.id) {
    const result = await supabase
      .from("agencies")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();
    const agencyRow = result.data as { name: string } | null;
    if (agencyRow?.name) {
      rawName = agencyRow.name;
    }
  }

  const userEmailFallback = user?.email?.split("@")[0] || "Utilizador";
  const firstName = rawName.trim()
    ? rawName.trim().split(/\s+/)[0] || userEmailFallback
    : userEmailFallback;

  const greeting = getLisbonGreeting();
  const currentDateFormatted = getLisbonFormattedDate();

  const featuredClient = clients[0] ?? null;
  const metrics = featuredClient
    ? await getSprintMetrics(featuredClient.id)
    : [];

  const pending = reports.filter((r) => r.status === "pending_approval" || r.status === "draft");
  const sent = reports.filter((r) => r.status === "sent");
  const failed = reports.filter((r) => r.status === "failed");
  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));

  const currentWeek = getIsoWeekNumber();
  const sprintSubtitle = !featuredClient
    ? "Sem dados ainda"
    : process.env.NEXT_PUBLIC_USE_MOCK === "true"
      ? `Semana ${currentWeek} · GitHub Projects (demo)`
      : `Semana ${currentWeek} · GitHub Projects`;

  const sentCount = sent.length;
  let timeSavedValue = "—";
  let timeSavedHint = "sem relatórios enviados";

  if (sentCount > 0) {
    const minutes = sentCount * 30;
    if (minutes >= 60) {
      const hours = (minutes / 60).toFixed(1).replace(/\.0$/, "");
      timeSavedValue = `${hours} h`;
    } else {
      timeSavedValue = `${minutes} min`;
    }
    timeSavedHint = "estimativa (~30 min/relatório)";
  }

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted-soft">
            {currentDateFormatted}
          </p>
          <h1 className="font-display mt-1.5 text-[30px] leading-tight text-ink sm:text-[34px]">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            {pending.length} relatórios pendentes de revisão · {clients.filter((c) => c.status === "active").length} clientes ativos
            {failed.length > 0 && (
              <span className="text-accent font-medium"> · {failed.length} com falha</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/onboarding" variant="secondary" size="sm">
            Assistente
          </ButtonLink>
          {pending[0] && (
            <ButtonLink href={`/dashboard/reports/${pending[0].id}`} size="sm">
              Rever rascunho
              <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          )}
        </div>
      </div>

      {/* Alerta de rascunhos para rever */}
      {pending.length > 0 && (
        <div
          role="region"
          aria-label="Alerta de rascunhos por rever"
          className="mt-6 flex flex-col gap-4 rounded-2xl border border-gold/40 bg-gradient-to-r from-gold-soft/80 via-gold-soft/30 to-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/20 text-[#8a5c00]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14.5px] font-semibold text-ink">
                  {pending.length === 1
                    ? "1 rascunho de relatório pronto para revisão"
                    : `${pending.length} rascunhos de relatório prontos para revisão`}
                </h2>
                <Badge tone="gold" dot>Ação necessária</Badge>
                {pending.some((p) => p.generatedWithoutAi) && (
                  <Badge tone="accent" dot>
                    Gerado sem IA — rever manualmente
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {pending[0]?.generatedWithoutAi
                  ? "As tarefas do GitHub foram agrupadas em bruto devido a uma indisponibilidade na IA. Revê o rascunho antes do envio."
                  : `A IA compilou as tarefas do GitHub Projects. Revê o resumo executivo antes do envio para ${clientById[pending[0].clientId]?.name || "o cliente"}.`}
              </p>
            </div>
          </div>
          <div className="shrink-0 self-start sm:self-center">
            <ButtonLink href={`/dashboard/reports/${pending[0].id}`} variant="primary" size="sm">
              Rever rascunho agora
              <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          </div>
        </div>
      )}

      {/* Alerta de relatórios com falha no envio */}
      {failed.length > 0 && (
        <div
          role="alert"
          aria-label="Alerta de relatórios com falha"
          className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft/40 p-5 shadow-sm"
        >
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14.5px] font-semibold text-ink">
                  {failed.length === 1
                    ? "1 relatório com falha no envio"
                    : `${failed.length} relatórios com falha no envio`}
                </h2>
                <Badge tone="accent" dot>Falha de envio</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                Ocorreu um erro no envio. Podes consultar os detalhes e reenviar manualmente.
              </p>

              <div className="mt-3.5 space-y-2.5">
                {failed.map((r) => {
                  const client = clientById[r.clientId];
                  return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-ink">
                            {client?.name}
                          </span>
                          <span className="text-[11.5px] text-muted-soft">
                            · {r.weekLabel}
                          </span>
                          <Badge tone="accent" dot>Falhado</Badge>
                        </div>
                        <p className="mt-1 text-[12px] text-accent-hover font-mono bg-accent-soft/50 rounded px-2 py-1 inline-block max-w-full truncate">
                          {r.errorMessage || "Falha na entrega de e-mail (Resend API)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Link
                          href={`/dashboard/reports/${r.id}`}
                          className="text-[12px] font-medium text-muted hover:text-ink px-2 py-1"
                        >
                          Ver detalhes
                        </Link>
                        <ResendButton reportId={r.id} size="sm" label="Reenviar agora" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Por aprovar"
          value={String(summary.pending)}
          hint="rascunhos prontos"
          icon={FileText}
          accent={summary.pending > 0}
        />
        <StatCard
          label="Enviados"
          value={String(summary.sentThisMonth)}
          hint="neste ciclo"
          icon={Mail}
        />
        <StatCard
          label="Taxa de conclusão"
          value={`${summary.avgCompletionRate}%`}
          hint="tarefas planeadas"
          icon={CheckCircle2}
        />
        <StatCard
          label="Tempo poupado"
          value={timeSavedValue}
          hint={timeSavedHint}
          icon={Clock}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        {/* Pending & Failed reports */}
        <section aria-labelledby="pendentes" className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 id="pendentes" className="text-[14.5px] font-semibold text-ink">
              Relatórios pendentes
            </h2>
            <div className="flex items-center gap-2">
              {failed.length > 0 && <Badge tone="accent">{failed.length} com falha</Badge>}
              <Badge tone="gold">{pending.length} por aprovar</Badge>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {[...failed, ...pending].map((r) => {
              const client = clientById[r.clientId];
              const st = statusBadge[r.status] ?? statusBadge.draft;
              const isFailed = r.status === "failed";
              return (
                <li key={r.id} className={cn(isFailed && "bg-accent-soft/20")}>
                  <div className="flex items-start justify-between gap-4 px-5 py-4">
                    <Link
                      href={`/dashboard/reports/${r.id}`}
                      className="group flex flex-1 items-start gap-4 min-w-0 transition-colors hover:bg-paper/70 rounded-lg p-1 -m-1"
                    >
                      <span className={cn(
                        "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                        isFailed ? "bg-accent-soft text-accent" : "bg-sand text-ink-soft"
                      )}>
                        {client?.avatarInitials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[13.5px] font-medium text-ink">
                            {client?.name}
                          </p>
                          <Badge tone={st.tone} dot>
                            {st.label}
                          </Badge>
                          {r.generatedWithoutAi && (
                            <Badge tone="accent" dot>
                              Gerado sem IA — rever manualmente
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[12.5px] text-muted">{r.subject}</p>
                        {isFailed && r.errorMessage && (
                          <p className="mt-1 text-[11.5px] font-mono text-accent-hover truncate">
                            Erro: {r.errorMessage}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-muted-soft">
                          {r.weekLabel} · {r.tasksCompleted}/{r.tasksPlanned} tarefas · gerado{" "}
                          {formatDateTime(r.generatedAt)}
                        </p>
                      </div>
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-line-strong transition-colors group-hover:text-accent" />
                    </Link>
                    {isFailed && (
                      <div className="shrink-0 self-center pl-2">
                        <ResendButton reportId={r.id} size="sm" />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Client status */}
        <section aria-labelledby="clientes" className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 id="clientes" className="text-[14.5px] font-semibold text-ink">
              Estado dos clientes
            </h2>
            <span className="text-[11.5px] text-muted">{clients.length} no total</span>
          </div>
          <ul className="divide-y divide-line">
            {clients.map((c) => {
              const lastSent = reports
                .filter((r) => r.clientId === c.id && r.status === "sent")
                .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))[0];
              return (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/70"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-[10.5px] font-semibold text-ink-soft">
                      {c.avatarInitials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{c.name}</p>
                      <p className="truncate text-[11px] text-muted">
                        {lastSent
                          ? lastSent.openedAt
                            ? `Último: enviado e aberto (${formatDateTime(lastSent.openedAt)})`
                            : `Último envio: ${formatDateTime(lastSent.sentAt)}`
                          : "Ainda sem relatórios"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                        c.status === "active" && "bg-teal-soft text-teal",
                        c.status === "onboarding" && "bg-gold-soft text-[#8a5c00]",
                        c.status === "paused" && "bg-sand text-muted",
                      )}
                    >
                      {c.status === "active" ? "Ativo" : c.status === "onboarding" ? "Onboarding" : "Pausado"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Sprint board + chart */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <section aria-labelledby="sprint" className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="sprint" className="text-[14.5px] font-semibold text-ink">
                Tarefas por sprint
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted">{sprintSubtitle}</p>
            </div>
            <Badge tone="muted">{featuredClient ? featuredClient.company : "Sem clientes"}</Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["done", "in_progress", "blocked"] as const).map((col) => {
              const items = cards.filter(
                (c) =>
                  c.column === col &&
                  Boolean(featuredClient && c.clientId === featuredClient.id),
              );
              const meta = columnMeta[col];
              return (
                <div key={col} className={cn("rounded-xl p-2.5", meta.bg)}>
                  <p className="flex items-center gap-1.5 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.tone)} />
                    {meta.label}
                    <span className="ml-auto text-muted-soft">{items.length}</span>
                  </p>
                  <ul className="space-y-1.5">
                    {items.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-lg border border-line/80 bg-surface px-2.5 py-2 shadow-[0_1px_1px_rgba(18,23,27,0.03)]"
                      >
                        <p className="text-[12px] leading-snug text-ink">{c.title}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-soft">
                          <span className="font-mono">{c.id}</span>
                          {c.label && (
                            <span className="rounded bg-sand px-1 py-px">{c.label}</span>
                          )}
                        </p>
                      </li>
                    ))}
                    {items.length === 0 && (
                      <li className="rounded-lg border border-dashed border-line-strong/60 px-2 py-3 text-center text-[11px] text-muted-soft">
                        Sem tarefas
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="andamento" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="andamento" className="text-[14.5px] font-semibold text-ink">
            Concluídas vs. planeadas
          </h2>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {featuredClient ? featuredClient.company : "Geral"} · métricas de sprint
          </p>
          <div className="mt-4">
            <PlannedVsCompletedChart data={metrics} />
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal" /> Concluídas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-line-strong" /> Planeadas
            </span>
          </div>
        </section>
      </div>

      {/* Sent reports */}
      <section aria-labelledby="enviados" className="mt-6 rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="enviados" className="text-[14.5px] font-semibold text-ink">
            Relatórios enviados
          </h2>
          <span className="text-[11.5px] text-muted">{sent.length} registos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <caption className="sr-only">Relatórios já enviados aos clientes</caption>
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-wide text-muted-soft">
                <th scope="col" className="px-5 py-2.5 font-semibold">Cliente</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Semana</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Enviado</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Abertura</th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">Tarefas</th>
              </tr>
            </thead>
            <tbody>
              {sent.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="px-5 py-3 text-[13px] font-medium text-ink">
                    {clientById[r.clientId]?.name}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-muted">{r.weekLabel}</td>
                  <td className="px-4 py-3 text-[12.5px] text-muted">{formatDateTime(r.sentAt)}</td>
                  <td className="px-4 py-3">
                    {r.openedAt ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-teal">
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Aberto
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted-soft">Ainda não aberto</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-[12.5px] tabular-nums text-ink-soft">
                    {r.tasksCompleted}/{r.tasksPlanned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-muted-soft">
        ClientPulse AI · Relatórios semanais automatizados
      </p>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent ? "border-accent/20 bg-accent-soft/60" : "border-line bg-surface",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</p>
        <Icon className={cn("h-4 w-4", accent ? "text-accent" : "text-muted-soft")} aria-hidden="true" />
      </div>
      <p className="font-display mt-2 text-[28px] leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted-soft">{hint}</p>
    </div>
  );
}

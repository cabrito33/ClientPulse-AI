import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react";
import { getClient, getReportsForClient, getSprintMetrics } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { CompletedBySprintChart } from "@/components/dashboard/charts";
import { GenerateReportButton } from "@/components/dashboard/generate-report-button";
import { RenewPortalLinkButton } from "@/components/dashboard/renew-portal-link-button";
import { ClientAutoSendToggle } from "@/components/dashboard/client-autosend-toggle";
import { ClientColumnMappingCard } from "@/components/dashboard/client-column-mapping";
import { formatDate, formatDateTime } from "@/lib/utils";

interface ClientPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ClientPageProps) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return { title: "Cliente não encontrado" };
  return {
    title: `Cliente — ${client.name}`,
  };
}

export default async function ClientDetailPage({ params }: ClientPageProps) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [reports, metrics] = await Promise.all([
    getReportsForClient(client.id),
    getSprintMetrics(client.id),
  ]);

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-7 sm:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Migalhas" className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/dashboard" className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Dashboard
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-muted">Clientes</span>
        <span aria-hidden="true">/</span>
        <span className="truncate text-ink font-medium">{client.name}</span>
      </nav>

      {/* Header */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sand text-sm font-bold text-ink-soft">
            {client.avatarInitials}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl text-ink sm:text-3xl">{client.name}</h1>
              <Badge tone={client.status === "active" ? "teal" : "gold"} dot>
                {client.status === "active" ? "Ativo" : client.status === "onboarding" ? "Onboarding" : "Pausado"}
              </Badge>
            </div>
            <p className="text-sm text-muted">{client.company} · {client.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/portal/${client.portalToken}`}
            className={buttonClass("secondary", "sm")}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Abrir portal do cliente
          </Link>
          <RenewPortalLinkButton clientId={client.id} />
          <GenerateReportButton clientId={client.id} />
          {reports[0] && (
            <Link
              href={`/dashboard/reports/${reports[0].id}`}
              className={buttonClass("secondary", "sm")}
            >
              Ver relatório recente
            </Link>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Reports list */}
        <section aria-labelledby="relatorios" className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 id="relatorios" className="text-sm font-semibold text-ink">
              Relatórios semanais
            </h2>
            <span className="text-xs text-muted">{reports.length} registos</span>
          </div>

          <div className="divide-y divide-line">
            {reports.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-4 transition-colors hover:bg-paper/60"
              >
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 text-muted-soft" />
                  <div>
                    <Link
                      href={`/dashboard/reports/${r.id}`}
                      className="text-sm font-medium text-ink hover:text-accent"
                    >
                      {r.weekLabel}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)} · {r.tasksCompleted}/{r.tasksPlanned} tarefas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === "sent" ? (
                    r.openedAt ? (
                      <span title={`Aberto pelo cliente em ${formatDateTime(r.openedAt)}`}>
                        <Badge tone="teal" dot>
                          Aberto
                        </Badge>
                      </span>
                    ) : (
                      <Badge tone="teal" dot>
                        Enviado
                      </Badge>
                    )
                  ) : r.status === "failed" ? (
                    <Badge tone="accent" dot>
                      Falha no envio
                    </Badge>
                  ) : (
                    <Badge tone="gold" dot>
                      Pendente de revisão
                    </Badge>
                  )}
                  {r.status === "sent" && r.openedAt && (
                    <span className="text-[11.5px] text-teal font-medium" title={formatDateTime(r.openedAt)}>
                      Aberto a {formatDate(r.openedAt)}
                    </span>
                  )}
                  <Link
                    href={`/dashboard/reports/${r.id}`}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Ver
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
              Configurações de Envio
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Frequência</dt>
                <dd className="font-medium text-ink-soft capitalize">
                  {client.frequency === "weekly" ? "Semanal" : "Quinzenal"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Dia e hora</dt>
                <dd className="font-medium text-ink-soft">{client.sendDay} às {client.sendTime}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tom de escrita</dt>
                <dd className="font-medium text-ink-soft capitalize">{client.tone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Idioma</dt>
                <dd className="font-medium text-ink-soft uppercase">{client.language}</dd>
              </div>
              <ClientAutoSendToggle clientId={client.id} initialAutoSend={client.autoSend} />
            </dl>
          </section>

          <ClientColumnMappingCard
            clientId={client.id}
            projectId={client.githubProjectId}
            initialMapping={client.columnMapping}
          />

          {metrics.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                Tarefas concluídas por sprint
              </h2>
              <div className="mt-4">
                <CompletedBySprintChart data={metrics} height={180} />
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

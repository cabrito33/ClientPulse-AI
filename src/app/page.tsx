import Link from "next/link";
import {
  ArrowRight,
  Check,
  X,
  Clock,
  MessageSquareDashed,
  Plug,
  Sparkles,
  ShieldCheck,
  Mail,
  MonitorSmartphone,
  LayoutDashboard,
  MessagesSquare,
  CircleDashed,
  Minus,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ReportMockup } from "@/components/marketing/report-mockup";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Relatórios semanais em minutos, não em horas",
  description:
    "O ClientPulse AI liga-se ao GitHub Projects, escreve o relatório semanal em linguagem de negócio e entrega-o ao cliente por e-mail e num portal sem login.",
};

export default function LandingPage() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
      >
        Saltar para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo">
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <Audience />
        <Comparison />
        <Pricing />
        <Faq />
        <Roadmap />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Section shell helpers                                              */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-accent">
      <span aria-hidden="true" className="h-px w-6 bg-accent/60" />
      {children}
    </p>
  );
}

function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-display mt-3 max-w-2xl text-[30px] leading-[1.08] text-ink sm:text-[38px] lg:text-[44px]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function SectionLead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted", className)}>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  1 · Hero                                                           */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grain opacity-[0.55] [mask-image:radial-gradient(ellipse_at_top,black_35%,transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-32 h-[520px] w-[520px] rounded-full bg-accent/[0.06] blur-2xl"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8 lg:pb-28 lg:pt-20">
        <div className="animate-rise">
          <Badge tone="accent" dot className="mb-6">
            Em validação · MVP académico
          </Badge>
          <h1 className="font-display text-[40px] leading-[1.02] tracking-tight text-ink sm:text-[56px] lg:text-[62px]">
            A sexta-feira acaba com um relatório{" "}
            <span className="relative inline-block">
              <span className="relative z-10">já escrito.</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-1.5 z-0 h-[0.42em] bg-gold/45"
              />
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-[16.5px] leading-relaxed text-ink-soft">
            O ClientPulse AI lê o teu GitHub Projects, transforma a semana de trabalho num resumo
            claro para o cliente e entrega-o por e-mail com link para um portal sem login. Revês e
            aprovas antes de sair.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/onboarding" size="lg" className="group">
              Ver demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink href="#como-funciona" variant="secondary" size="lg">
              Como funciona
            </ButtonLink>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6">
            {[
              { v: "< 5 min", k: "do onboarding ao 1.º relatório" },
              { v: "3 blocos", k: "feito · bloqueios · próximos" },
              { v: "0 logins", k: "para o teu cliente" },
            ].map((s) => (
              <div key={s.k}>
                <dt className="sr-only">{s.k}</dt>
                <dd className="font-display text-xl text-ink">{s.v}</dd>
                <dd className="mt-1 text-[12px] leading-snug text-muted">{s.k}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-[11.5px] text-muted-soft">
            Metas do projeto definidas no PRD, por validar com utilizadores reais.
          </p>
        </div>

        <div className="animate-rise lg:pl-4" style={{ animationDelay: "120ms" }}>
          <ReportMockup className="mx-auto max-w-[440px] lg:max-w-none" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  2 · Problem                                                        */
/* ------------------------------------------------------------------ */

const pains = [
  {
    icon: Clock,
    title: "Horas que ninguém fatura",
    body: "Compilar o estado das tarefas, escrever o e-mail e traduzir jargão técnico rouba tempo todas as semanas. A estimativa do grupo é de 2 a 3 horas semanais por freelancer, e mais numa agência.",
    note: "Estimativa do grupo, ainda sem medição própria.",
  },
  {
    icon: MessageSquareDashed,
    title: "«Em que ponto estamos?»",
    body: "Quando o cliente não tem visibilidade, pergunta. Um relato de uma agência de 4 pessoas descreve mais de 3 horas numa semana só a responder a três clientes.",
    note: "Relato publicado na DEV Community [9].",
  },
  {
    icon: MonitorSmartphone,
    title: "O board interno não chega",
    body: "Partilhar o Notion ou o GitHub não resolve: o cliente não percebe tarefas técnicas e acaba com mais dúvidas, não menos. Falta uma vista em linguagem de negócio.",
    note: "Relato de um freelancer na Indie Hackers [8].",
  },
];

function Problem() {
  return (
    <section id="problema" className="scroll-mt-20 border-y border-line bg-sand/40">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Eyebrow>O problema</Eyebrow>
            <SectionTitle>
              O trabalho está feito.
              <br />
              <span className="text-muted">O cliente é que não sabe.</span>
            </SectionTitle>
            <SectionLead>
              A comunicação de progresso é o imposto invisível de quem trabalha por conta própria.
              Custa tempo, não aparece em nenhuma fatura e, quando falha, custa clientes.
            </SectionLead>
            <div className="mt-8 rounded-xl border border-line bg-surface p-5">
              <p className="font-display text-[17px] leading-snug text-ink">
                «Os clientes escreviam-me três vezes por semana a perguntar onde estava o projeto.»
              </p>
              <p className="mt-2 text-[12px] text-muted">
                Relato de um freelancer, Indie Hackers — evidência individual, não estatística.
              </p>
            </div>
          </div>

          <ul className="space-y-4">
            {pains.map((p) => (
              <li
                key={p.title}
                className="group rounded-2xl border border-line bg-surface p-6 transition-shadow hover:shadow-lift"
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent transition-transform group-hover:-rotate-3">
                    <p.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[16.5px] font-semibold text-ink">{p.title}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{p.body}</p>
                    <p className="mt-3 text-[11.5px] font-medium uppercase tracking-wide text-muted-soft">
                      {p.note}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  3 · How it works                                                   */
/* ------------------------------------------------------------------ */

const steps = [
  {
    n: "01",
    icon: Plug,
    title: "Ligas o GitHub Projects",
    body: "O assistente guia-te na ligação e no mapeamento das colunas do board para «Concluído», «Em curso» e «Bloqueado».",
    link: { href: "/onboarding", label: "Experimentar o assistente" },
  },
  {
    n: "02",
    icon: Sparkles,
    title: "A IA escreve o rascunho",
    body: "A partir dos metadados das tarefas — nunca do código — sai um relatório em três blocos, no tom e idioma de cada cliente.",
    link: { href: "/dashboard/reports/rpt-atelier-w42", label: "Ver um rascunho" },
  },
  {
    n: "03",
    icon: Check,
    title: "Revês e aprovas",
    body: "Ajustas uma frase, confirmas os números e clicas em «Aprovar e enviar». Ou desligas a aprovação e deixas correr sozinho.",
    link: { href: "/dashboard", label: "Abrir o dashboard" },
  },
  {
    n: "04",
    icon: Mail,
    title: "O cliente recebe",
    body: "Um e-mail com o resumo e um link seguro para o portal: relatório da semana, histórico e gráfico de tarefas por sprint. Sem conta.",
    link: { href: "/portal/demo-abc123", label: "Abrir o portal do cliente" },
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Como funciona</Eyebrow>
            <SectionTitle>Quatro passos. Uma sexta-feira tranquila.</SectionTitle>
          </div>
          <ButtonLink href="/onboarding" variant="secondary" size="sm" className="shrink-0">
            Ver demonstração
            <ArrowRight className="h-3.5 w-3.5" />
          </ButtonLink>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="group relative bg-surface p-6 transition-colors hover:bg-paper">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink transition-colors group-hover:border-accent group-hover:text-accent">
                  <s.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="font-display text-2xl text-line-strong transition-colors group-hover:text-accent/40">
                  {s.n}
                </span>
              </div>
              <h3 className="mt-5 text-[15.5px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
              <Link
                href={s.link.href}
                className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"
              >
                {s.link.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  4 · Features                                                       */
/* ------------------------------------------------------------------ */

const features = [
  {
    icon: Plug,
    title: "Sync com GitHub Projects",
    body: "Lê issues, colunas de estado, etiquetas e responsáveis. Nunca lê ficheiros ou código-fonte.",
  },
  {
    icon: Sparkles,
    title: "Relatório por IA em 3 blocos",
    body: "Feito, Bloqueios e Próximos passos, adaptados ao idioma (PT/EN) e ao tom de cada cliente.",
  },
  {
    icon: Check,
    title: "Aprovação ou envio direto",
    body: "Por defeito, o profissional revê antes de sair. Um interruptor por cliente ativa o envio automático.",
  },
  {
    icon: MonitorSmartphone,
    title: "Portal do cliente sem login",
    body: "Link seguro e só de leitura, com o relatório da semana, o histórico e o gráfico por sprint.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard do profissional",
    body: "Rascunhos pendentes, relatórios enviados, estado dos clientes e tarefas por sprint num só ecrã.",
  },
  {
    icon: MessagesSquare,
    title: "Assistente de onboarding",
    body: "Chat que conduz a ligação ao GitHub, o mapeamento de colunas e a criação do primeiro cliente.",
  },
];

function Features() {
  return (
    <section id="funcionalidades" className="scroll-mt-20 border-y border-line bg-sand/40">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Funcionalidades do MVP</Eyebrow>
          <SectionTitle>
            Tudo o que precisas para fechar a semana.{" "}
            <span className="text-muted">Nada que não precises.</span>
          </SectionTitle>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <article
              key={f.title}
              className={cn(
                "group rounded-2xl border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift",
                i === 1 && "sm:col-span-2 lg:col-span-1",
              )}
            >
              <span className="inline-grid h-10 w-10 place-items-center rounded-xl bg-sand text-ink-soft transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                <f.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-[15.5px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{f.body}</p>
            </article>
          ))}
        </div>

        <p className="mt-8 flex items-center gap-2 text-[12px] text-muted">
          <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
          Protótipo navegável com dados de demonstração. Sem integrações reais nesta fase.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  5 · Audience                                                       */
/* ------------------------------------------------------------------ */

function Audience() {
  return (
    <section id="para-quem" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <Eyebrow>Para quem é</Eyebrow>
            <SectionTitle>Feito para quem vende o próprio tempo.</SectionTitle>
            <SectionLead>
              Não é uma ferramenta para equipas de 200 pessoas. É para quem gere entre dois e dez
              projetos ao mesmo tempo e responde pessoalmente ao cliente.
            </SectionLead>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                tag: "Segmento secundário",
                title: "Freelancers e consultores seniores",
                points: [
                  "Desenvolvimento web, design, consultoria, marketing",
                  "Gere 2 a 5 clientes de ticket médio-alto",
                  "Já organiza o trabalho no GitHub Projects",
                ],
                price: "Plano Individual · hipótese de 15–29 €/mês",
              },
              {
                tag: "Segmento principal",
                title: "Pequenas agências digitais",
                points: [
                  "2 a 10 colaboradores",
                  "Justifica avenças mensais com entregas visíveis",
                  "Quer proteger a equipa de interrupções constantes",
                ],
                price: "Plano Agência · hipótese de 49–99 €/mês",
              },
            ].map((s) => (
              <div
                key={s.title}
                className="flex flex-col rounded-2xl border border-line bg-surface p-6"
              >
                <Badge tone="muted" className="self-start">
                  {s.tag}
                </Badge>
                <h3 className="mt-4 text-[17px] font-semibold leading-snug text-ink">{s.title}</h3>
                <ul className="mt-4 flex-1 space-y-2.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2 text-[13.5px] leading-snug text-muted">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-line pt-4 text-[12px] font-medium text-ink-soft">
                  {s.price}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-[11.5px] text-muted-soft">
          Preços indicativos e não validados. Ver nota na secção de preços.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  6 · Comparison                                                     */
/* ------------------------------------------------------------------ */

type Cell = boolean | "partial";

const competitors = [
  "ClientPulse AI",
  "Briefd",
  "AgencyAnalytics / DashThis",
  "Copilot (Assembly) / ManyRequests",
  "Notion / Taskade",
  "Processo manual",
];

const comparison: { label: string; values: Cell[] }[] = [
  { label: "Recolha automática das tarefas", values: [true, false, true, "partial", "partial", false] },
  { label: "Síntese por IA em linguagem de negócio", values: [true, false, false, false, "partial", false] },
  { label: "Fluxo de aprovação antes do envio", values: [true, false, "partial", "partial", false, false] },
  { label: "Envio semanal agendado", values: [true, "partial", true, true, "partial", false] },
  { label: "Portal do cliente sem login", values: [true, false, false, false, false, false] },
  { label: "Foco em entregas qualitativas (não métricas de ads)", values: [true, true, false, "partial", "partial", true] },
  { label: "Setup em menos de 5 minutos", values: [true, true, "partial", false, false, true] },
];

function CellIcon({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-soft text-teal">
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
        <span className="sr-only">Sim</span>
      </span>
    );
  if (v === "partial")
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-soft text-[#8a5c00]">
        <Minus className="h-3.5 w-3.5" strokeWidth={2.6} />
        <span className="sr-only">Parcial</span>
      </span>
    );
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sand text-muted-soft">
      <X className="h-3.5 w-3.5" strokeWidth={2.4} />
      <span className="sr-only">Não</span>
    </span>
  );
}

function Comparison() {
  return (
    <section id="comparacao" className="scroll-mt-20 border-y border-line bg-sand/40">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Comparação honesta</Eyebrow>
          <SectionTitle>Onde o ClientPulse AI se distingue — e onde não.</SectionTitle>
          <SectionLead>
            Construído apenas a partir do relatório de validação. As marcas pertencem aos seus
            donos; a comparação é uma leitura do grupo, não um teste de produto.
          </SectionLead>
        </div>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <caption className="sr-only">
              Comparação de funcionalidades entre ClientPulse AI e soluções alternativas
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-[34%] px-5 py-4 text-[12px] font-semibold uppercase tracking-wide text-muted-soft">
                  Funcionalidade
                </th>
                {competitors.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      "px-3 py-4 text-center text-[12px] font-medium leading-tight text-ink-soft",
                      i === 0 && "bg-accent-soft/60 font-semibold text-accent-hover",
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label} className="border-b border-line/70 last:border-0">
                  <th scope="row" className="px-5 py-3.5 text-[13px] font-normal leading-snug text-ink-soft">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={`${row.label}-${i}`}
                      className={cn("px-3 py-3.5 text-center", i === 0 && "bg-accent-soft/30")}
                    >
                      <CellIcon v={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 text-[12.5px] leading-relaxed text-muted sm:grid-cols-3">
          <p>
            <strong className="font-semibold text-ink-soft">Briefd</strong> segue o mesmo formato de
            três blocos, mas exige preenchimento manual.
          </p>
          <p>
            <strong className="font-semibold text-ink-soft">AgencyAnalytics / DashThis</strong>{" "}
            automatizam métricas quantitativas de marketing, não entregas de engenharia ou design.
          </p>
          <p>
            <strong className="font-semibold text-ink-soft">Portais completos</strong> como o
            Copilot exigem conta ao cliente e configuração extensa.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  7 · Pricing                                                        */
/* ------------------------------------------------------------------ */

const plans = [
  {
    name: "Individual",
    tag: "Freelancers e consultores",
    price: "15–29 €",
    period: "/mês",
    features: [
      "Até 5 clientes ativos",
      "Relatórios semanais ilimitados",
      "Portal do cliente com histórico",
      "Assistente de onboarding",
    ],
    cta: "Ver demo",
    href: "/dashboard",
    featured: false,
  },
  {
    name: "Agência",
    tag: "Equipas de 2 a 10 pessoas",
    price: "49–99 €",
    period: "/mês",
    features: [
      "Clientes ilimitados",
      "Vários utilizadores internos",
      "Tom e idioma por cliente",
      "Envio automático por cliente",
      "Suporte prioritário",
    ],
    cta: "Ver demo",
    href: "/dashboard",
    featured: true,
  },
];

function Pricing() {
  return (
    <section id="precos" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Preços</Eyebrow>
          <SectionTitle>Preços de partida. Não de promessa.</SectionTitle>
          <SectionLead>
            Estes valores são hipóteses baseadas nos preços da concorrência e ainda não foram
            testados com utilizadores. Não há pagamentos neste protótipo.
          </SectionLead>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold-soft/60 px-4 py-3 text-[12.5px] leading-relaxed text-[#6d4a00]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">Aviso de honestidade:</strong> os intervalos abaixo
            são indicativos e sujeitos a validação. Não representam oferta comercial disponível.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {plans.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-7",
                p.featured
                  ? "border-ink bg-ink text-paper shadow-float"
                  : "border-line bg-surface",
              )}
            >
              {p.featured && (
                <span className="absolute -top-3 left-7 rounded-full bg-gold px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink">
                  Mais indicado para agências
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <h3 className={cn("text-[18px] font-semibold", p.featured ? "text-paper" : "text-ink")}>
                  {p.name}
                </h3>
                <span
                  className={cn(
                    "text-[11.5px]",
                    p.featured ? "text-paper/60" : "text-muted",
                  )}
                >
                  {p.tag}
                </span>
              </div>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-[38px] leading-none">{p.price}</span>
                <span className={cn("text-sm", p.featured ? "text-paper/60" : "text-muted")}>
                  {p.period}
                </span>
              </p>
              <p className={cn("mt-1 text-[11.5px]", p.featured ? "text-paper/50" : "text-muted-soft")}>
                Intervalo hipotético, por validar
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[13.5px]">
                    <Check
                      className={cn("mt-0.5 h-4 w-4 shrink-0", p.featured ? "text-gold" : "text-teal")}
                      aria-hidden="true"
                    />
                    <span className={p.featured ? "text-paper/85" : "text-ink-soft"}>{f}</span>
                  </li>
                ))}
              </ul>
              <ButtonLink
                href={p.href}
                variant={p.featured ? "primary" : "secondary"}
                className="mt-7 w-full"
              >
                {p.cta}
              </ButtonLink>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  8 · FAQ                                                            */
/* ------------------------------------------------------------------ */

const faqs = [
  {
    q: "Que dados do GitHub é que o ClientPulse AI lê?",
    a: "Apenas metadados de tarefas: título, descrição, estado, etiquetas e responsáveis das issues do GitHub Projects. O código-fonte dos repositórios nunca é lido, analisado nem armazenado.",
  },
  {
    q: "O texto é escrito pela IA sem ninguém ver?",
    a: "Por defeito, não. O rascunho fica pendente de aprovação e o profissional pode editá-lo antes do envio. O envio automático existe, mas é uma opção desligada por omissão e ativada cliente a cliente.",
  },
  {
    q: "O cliente precisa de criar conta no portal?",
    a: "Não. O cliente recebe um e-mail com um link único e não adivinhável para o portal. A página é só de leitura, sem login nem palavras-passe, e o acesso pode ser revogado pelo profissional.",
  },
  {
    q: "E se a IA inventar uma tarefa que não existe?",
    a: "O relatório é gerado apenas a partir dos dados recolhidos do board e passa sempre por revisão humana por defeito. A qualidade é medida no projeto: pelo menos 80% das tarefas concluídas devem aparecer corretamente.",
  },
  {
    q: "Que idiomas e tons estão disponíveis?",
    a: "Português e inglês, com três tons por cliente: formal, executivo e descontraído. A periodicidade também é configurável (semanal, quinzenal ou mensal).",
  },
  {
    q: "Isto já funciona com o meu GitHub?",
    a: "Nesta fase é um protótipo navegável com dados simulados. A integração real com a API do GitHub, o modelo de IA e o envio de e-mail são os próximos passos do roadmap.",
  },
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-y border-line bg-sand/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16 lg:py-24">
        <div>
          <Eyebrow>Perguntas frequentes</Eyebrow>
          <SectionTitle>Privacidade, controlo e expectativas claras.</SectionTitle>
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
            Se a tua dúvida não estiver aqui, o assistente de onboarding cobre o essencial do
            produto.
          </p>
          <ButtonLink href="/onboarding" variant="secondary" size="sm" className="mt-5">
            Falar com o assistente
          </ButtonLink>
        </div>

        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[14.5px] font-medium text-ink">
                {f.q}
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-muted transition-transform duration-200 group-open:rotate-45 group-open:border-accent group-open:text-accent">
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 pr-8 text-[13.5px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  9 · Roadmap                                                        */
/* ------------------------------------------------------------------ */

const roadmap = [
  {
    phase: "MVP · em construção",
    now: true,
    items: [
      "Ligação ao GitHub Projects",
      "Relatório por IA em 3 blocos",
      "Aprovação e envio automático",
      "Portal do cliente sem login",
      "Dashboard e assistente de onboarding",
    ],
  },
  {
    phase: "Seguinte",
    now: false,
    items: [
      "Integrações com Trello, Notion e Jira",
      "Micro-aprovações do cliente no portal",
      "Login opcional para o cliente final",
      "Métricas de leitura e reagendamento",
    ],
  },
];

function Roadmap() {
  return (
    <section id="roadmap" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Roadmap</Eyebrow>
          <SectionTitle>O que está feito e o que vem a seguir.</SectionTitle>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {roadmap.map((r) => (
            <div key={r.phase} className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    r.now ? "bg-accent ring-4 ring-accent/15" : "bg-line-strong",
                  )}
                />
                <h3 className="text-[14px] font-semibold uppercase tracking-wide text-ink-soft">
                  {r.phase}
                </h3>
              </div>
              <ul className="mt-5 space-y-3">
                {r.items.map((i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-ink-soft">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        r.now ? "bg-accent/70" : "bg-line-strong",
                      )}
                    />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  10 · Final CTA                                                     */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="px-5 pb-20 sm:px-8 lg:pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink px-6 py-16 text-center sm:px-12 lg:py-20">
        <div aria-hidden="true" className="absolute inset-0 bg-grid opacity-[0.06]" />
        <div
          aria-hidden="true"
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative">
          <div className="flex justify-center">
            <Logo inverted href={null} className="text-paper" />
          </div>
          <h2 className="font-display mx-auto mt-7 max-w-2xl text-[32px] leading-[1.08] text-paper sm:text-[42px]">
            A próxima sexta-feira pode terminar às 17h00.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-paper/65">
            Percorre o protótipo completo — onboarding, dashboard, revisão de rascunho e portal do
            cliente — com dados de demonstração.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/onboarding" size="lg">
              Começar a demo
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink
              href="/portal/demo-abc123"
              size="lg"
              variant="secondary"
              className="border-paper/20 bg-transparent text-paper hover:border-paper/40 hover:bg-paper/10"
            >
              Ver portal do cliente
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

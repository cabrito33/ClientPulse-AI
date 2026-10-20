"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Sparkles,
  Settings,
  ArrowUpRight,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/reports/rpt-atelier-w42", label: "Revisão de rascunho", icon: FileText, exact: true },
  { href: "/dashboard/clients/atelier-mira", label: "Clientes", icon: Users, exact: true },
];

export function DashboardSidebar({ pending }: { pending: number }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-sand/40 lg:flex">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Logo />
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5">
        <p className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-soft">
          Profissional
        </p>
        <nav aria-label="Navegação do dashboard" className="space-y-0.5">
          {nav.map((item) => {
            const active = item.exact
              ? pathname === item.href || pathname.startsWith(item.href + "/")
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
                  active
                    ? "bg-surface text-ink shadow-[0_1px_0_rgba(18,23,27,0.04),0_1px_3px_rgba(18,23,27,0.06)]"
                    : "text-muted hover:bg-sand hover:text-ink",
                )}
              >
                <item.icon className={cn("h-4 w-4", active ? "text-accent" : "text-muted-soft")} aria-hidden="true" />
                {item.label}
                {item.label === "Visão geral" && pending > 0 && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {pending}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <p className="px-2 pb-2 pt-6 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-soft">
          Demonstração
        </p>
        <nav aria-label="Atalhos de demonstração" className="space-y-0.5">
          <Link
            href="/onboarding"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-muted transition-colors hover:bg-sand hover:text-ink"
          >
            <Sparkles className="h-4 w-4 text-muted-soft" aria-hidden="true" />
            Assistente
          </Link>
          <Link
            href="/portal/demo-abc123"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-muted transition-colors hover:bg-sand hover:text-ink"
          >
            <ArrowUpRight className="h-4 w-4 text-muted-soft" aria-hidden="true" />
            Portal do cliente
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-muted transition-colors hover:bg-sand hover:text-ink"
          >
            <Settings className="h-4 w-4 text-muted-soft" aria-hidden="true" />
            Voltar ao site
          </Link>
        </nav>
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-surface p-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-semibold text-paper">
            MD
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-ink">Maria Duarte</p>
            <p className="truncate text-[10.5px] text-muted">Studio Duarte · demo</p>
          </div>
        </div>
        <Badge tone="gold" className="mt-2 w-full justify-center">
          Dados de demonstração
        </Badge>
      </div>
    </aside>
  );
}

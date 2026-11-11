"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Sparkles,
  ArrowUpRight,
  Menu,
  X,
  ArrowLeft,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

export function DashboardTopbar({
  pending,
  firstPortalToken,
  firstClientId,
  firstReportId,
}: {
  pending: number;
  firstPortalToken?: string | null;
  firstClientId?: string | null;
  firstReportId?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const reportsHref = firstReportId ? `/dashboard/reports/${firstReportId}` : "/dashboard";
  const clientsHref = firstClientId ? `/dashboard/clients/${firstClientId}` : "/onboarding";

  const links = [
    { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
    { href: reportsHref, label: "Rascunhos", icon: FileText },
    { href: clientsHref, label: "Clientes", icon: Users },
    { href: "/onboarding", label: "Assistente", icon: Sparkles },
    ...(firstPortalToken
      ? [{ href: `/portal/${firstPortalToken}`, label: "Portal do cliente", icon: ArrowUpRight }]
      : []),
  ];

  return (
    <div className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <Link
              href={reportsHref}
              className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              {pending} por aprovar
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="grid h-9 w-9 place-items-center rounded-full border border-line"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Navegação do dashboard (móvel)" className="border-t border-line bg-paper px-3 py-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm",
                pathname === l.href ? "bg-sand font-medium text-ink" : "text-muted",
              )}
            >
              <l.icon className="h-4 w-4" aria-hidden="true" />
              {l.label}
            </Link>
          ))}
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar ao site
          </Link>
        </nav>
      )}
    </div>
  );
}

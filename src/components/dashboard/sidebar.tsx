"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Sparkles,
  Settings,
  ArrowUpRight,
  LogOut,
  LogIn,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function DashboardSidebar({
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
  const router = useRouter();

  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const name =
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email?.split("@")[0] ||
            "Utilizador";
          setUser({ name, email: authUser.email || "" });
        }
      } catch {
        // Fallback for mock/demo mode
      }
    }
    loadUser();
  }, []);

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  }

  const reportsHref = firstReportId ? `/dashboard/reports/${firstReportId}` : "/dashboard";
  const clientsHref = firstClientId ? `/dashboard/clients/${firstClientId}` : "/onboarding";

  const nav = [
    { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard, exact: true },
    { href: reportsHref, label: "Revisão de rascunho", icon: FileText, exact: false },
    { href: clientsHref, label: "Clientes", icon: Users, exact: false },
  ];

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CP";

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
          Atalhos
        </p>
        <nav aria-label="Atalhos" className="space-y-0.5">
          <Link
            href="/onboarding"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-muted transition-colors hover:bg-sand hover:text-ink"
          >
            <Sparkles className="h-4 w-4 text-muted-soft" aria-hidden="true" />
            Assistente
          </Link>
          {firstPortalToken && (
            <Link
              href={`/portal/${firstPortalToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-muted transition-colors hover:bg-sand hover:text-ink"
            >
              <ArrowUpRight className="h-4 w-4 text-muted-soft" aria-hidden="true" />
              Portal do cliente
            </Link>
          )}
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
        <div className="flex items-center justify-between rounded-xl bg-surface p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-paper">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-ink">
                {user?.name || "Utilizador"}
              </p>
              <p className="truncate text-[10.5px] text-muted">
                {user?.email || ""}
              </p>
            </div>
          </div>
          {user ? (
            <button
              onClick={handleSignOut}
              title="Terminar sessão"
              aria-label="Terminar sessão"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-accent/10 hover:text-accent"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              href="/login"
              title="Iniciar sessão"
              aria-label="Iniciar sessão"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-sand hover:text-ink"
            >
              <LogIn className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

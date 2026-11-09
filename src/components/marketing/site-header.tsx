"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#problema", label: "Problema" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#funcionalidades", label: "Funcionalidades" },
  { href: "/#precos", label: "Preços" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-line/80 bg-paper/85 backdrop-blur-md"
          : "border-transparent bg-paper/0",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-2 text-[13.5px] text-muted transition-colors hover:bg-sand hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Entrar
          </ButtonLink>
          <ButtonLink href="/dashboard" variant="ghost" size="sm">
            Dashboard
          </ButtonLink>
          <ButtonLink href="/onboarding" variant="dark" size="sm">
            Ver demo
          </ButtonLink>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-line bg-paper px-5 pb-6 pt-4 md:hidden">
          <nav aria-label="Navegação móvel" className="flex flex-col">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/70 py-3 text-[15px] text-ink-soft"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-2">
            <ButtonLink href="/login" variant="secondary" onClick={() => setOpen(false)}>
              Iniciar sessão
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary" onClick={() => setOpen(false)}>
              Entrar no dashboard (demo)
            </ButtonLink>
            <ButtonLink href="/onboarding" variant="primary" onClick={() => setOpen(false)}>
              Ver demo do onboarding
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}

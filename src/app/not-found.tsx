import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";

export const metadata = {
  title: "Página não encontrada — 404",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo href="/" />
        </div>
      </header>

      <main className="mx-auto flex flex-1 max-w-md flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
        <Badge tone="neutral">Erro 404</Badge>

        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Página não encontrada
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          A página que procuras não existe, foi movida ou o endereço introduzido está incorreto.
        </p>

        <div className="mt-8">
          <Link href="/" className={buttonClass("primary", "md")}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar à página inicial
          </Link>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { buttonClass } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: agencyName.trim() || fullName.trim(),
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // If session is created directly or email confirmation disabled
      if (data.session) {
        router.push("/onboarding");
      } else {
        // Confirmation email sent or pending
        router.push("/onboarding");
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro ao criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-paper px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-ink">
          Criar conta no ClientPulse AI
        </h2>
        <p className="mt-2 text-center text-sm text-muted">
          Configure a sua agência e comece a gerar relatórios em 5 minutos
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4 text-sm text-accent">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Nome Completo
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Maria Duarte"
                className="mt-1.5 block w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted-soft focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="agencyName" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Nome da Agência ou Estúdio
              </label>
              <input
                id="agencyName"
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Studio Duarte"
                className="mt-1.5 block w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted-soft focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@studioduarte.pt"
                className="mt-1.5 block w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted-soft focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Palavra-passe (mínimo 6 caracteres)
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 block w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted-soft focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={buttonClass("primary", "md", "w-full mt-2")}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>A criar conta...</span>
                </>
              ) : (
                <>
                  <span>Criar conta e iniciar onboarding</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-line pt-6 text-center text-sm">
            <p className="text-muted">
              Já tem conta?{" "}
              <Link href="/login" className="font-semibold text-accent hover:underline">
                Iniciar sessão
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

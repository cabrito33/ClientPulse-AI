"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bot,
  Check,
  CheckCircle2,
  Mic,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Columns3,
  UserCheck,
  Send,
  Loader2,
} from "lucide-react";
import {
  sendOnboardingMessageAction,
  listGitHubProjectsAction,
  fetchProjectColumnsAction,
  checkGitHubIntegrationStatusAction,
  completeOnboardingAction,
  type OnboardingChatMessage,
} from "@/app/actions/onboarding";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

interface OnboardingProject {
  id: string;
  number?: number;
  title: string;
  columns: string[];
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [projects, setProjects] = useState<OnboardingProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<OnboardingProject | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [columnMap, setColumnMap] = useState({
    done: "Concluído",
    in_progress: "Em curso",
    blocked: "Bloqueado",
  });
  const [clientData, setClientData] = useState({
    name: "Atelier Mira",
    email: "joana@ateliermira.pt",
    tone: "formal",
    language: "pt",
    frequency: "weekly",
  });

  const [messages, setMessages] = useState<OnboardingChatMessage[]>([
    {
      role: "assistant",
      content:
        "Olá! Vou ajudar-te a configurar a tua conta em menos de 5 minutos. Primeiro, conecta a tua conta do GitHub colando o teu Personal Access Token (PAT) ou escolhendo o teu board.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);

  const handleSelectProject = useCallback(async (proj: OnboardingProject) => {
    setSelectedProject(proj);
    if (proj.columns && proj.columns.length > 0) {
      return;
    }
    setIsLoadingColumns(true);
    try {
      const colRes = await fetchProjectColumnsAction(proj.id);
      if (colRes.success && colRes.columns.length > 0) {
        const cols = colRes.columns;
        proj.columns = cols;
        setProjects((prev) =>
          prev.map((p) => (p.id === proj.id ? { ...p, columns: cols } : p))
        );
        setSelectedProject((curr) =>
          curr && curr.id === proj.id ? { ...curr, columns: cols } : curr
        );

        // Auto-mapping inteligente de colunas
        const lowerCols = cols.map((c) => ({ raw: c, low: c.toLowerCase() }));
        const doneMatch =
          lowerCols.find((c) =>
            /done|conclu|pronto|terminad|entregue/i.test(c.low)
          )?.raw || cols[cols.length - 1];

        const inProgMatch =
          lowerCols.find((c) =>
            /progress|curso|desenvolv|fazendo|fazer/i.test(c.low)
          )?.raw || cols[Math.min(1, cols.length - 1)];

        const blockMatch =
          lowerCols.find((c) =>
            /block|bloque|imped|paus/i.test(c.low)
          )?.raw || cols[0];

        setColumnMap({
          done: doneMatch,
          in_progress: inProgMatch,
          blocked: blockMatch,
        });
      }
    } catch (err) {
      console.error("Erro ao carregar colunas:", err);
    } finally {
      setIsLoadingColumns(false);
    }
  }, []);

  const loadProjects = useCallback(
    async (owner?: string) => {
      setIsLoadingProjects(true);
      setProjectsError(null);
      try {
        const res = await listGitHubProjectsAction(owner);
        if (res.success && res.projects) {
          if (res.projects.length === 0) {
            setProjects([]);
            setSelectedProject(null);
            setProjectsError(
              "Nenhum board encontrado nesta conta GitHub. Certifica-te de que tens um GitHub Project (v2) ativo e que o token tem permissões."
            );
          } else {
            const mapped: OnboardingProject[] = res.projects.map((p) => ({
              id: p.id,
              number: p.number,
              title: p.title,
              columns: [],
            }));
            setProjects(mapped);
            handleSelectProject(mapped[0]);
          }
        } else if (!res.success) {
          setProjectsError(res.error);
        }
      } catch (err: unknown) {
        setProjectsError(
          err instanceof Error ? err.message : "Erro ao carregar projetos do GitHub."
        );
      } finally {
        setIsLoadingProjects(false);
      }
    },
    [handleSelectProject]
  );

  useEffect(() => {
    async function initCheck() {
      try {
        const status = await checkGitHubIntegrationStatusAction();
        if (status.isConnected) {
          setGithubConnected(true);
          if (status.username) {
            setGithubUsername(status.username);
          }
          await loadProjects(status.username || undefined);
        }
      } catch (err) {
        console.warn("Erro ao verificar integração:", err);
      }
    }
    initCheck();
  }, [loadProjects]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const rawText = chatInput.trim();
    if (!rawText || isChatLoading) return;

    // Limpar o campo imediatamente para nunca reter o PAT no formulário
    setChatInput("");
    setChatError(null);

    // Mascarar o PAT no estado local do browser para nunca guardar em texto simples
    const patRegex = /(github_pat_[a-zA-Z0-9_]{30,}|ghp_[a-zA-Z0-9]{36,})/;
    const isPat = patRegex.test(rawText);
    const displayContent = isPat
      ? "•••••••••••••••••••••••••••••••• (Token PAT do GitHub enviado)"
      : rawText;

    const previousHistory = [...messages];
    setMessages((prev) => [...prev, { role: "user", content: displayContent }]);
    setIsChatLoading(true);

    try {
      const res = await sendOnboardingMessageAction(rawText, previousHistory, {
        current_step: step,
        selected_project: selectedProject?.title,
      });
      if (res.success && res.data) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.data.reply },
        ]);

        if (res.data.github_status?.is_connected) {
          setGithubConnected(true);
          const u = res.data.github_status.username || undefined;
          if (u) setGithubUsername(u);
          loadProjects(u);
        }

        if (res.data.action_detected?.action === "pat_validated") {
          setGithubConnected(true);
          const u = (res.data.action_detected.data?.username as string) || undefined;
          if (u) setGithubUsername(u);
          loadProjects(u);
        }
      } else {
        const err = !res.success ? res.error : "Não foi possível obter resposta.";
        setChatError(err);
      }
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
    } finally {
      setIsChatLoading(false);
    }
  }

  async function handleFinishStep3() {
    if (!selectedProject) {
      setSubmitError("Por favor seleciona um board do GitHub no Passo 1.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await completeOnboardingAction({
        clientName: clientData.name,
        clientEmail: clientData.email,
        projectId: selectedProject.id,
        projectOwner: githubUsername || "default",
        tone: clientData.tone as "formal" | "executivo" | "descontraido",
        language: clientData.language as "pt" | "en",
        columnMapping: columnMap,
      });

      if (res.success) {
        if (res.reportId) {
          setCreatedReportId(res.reportId);
        }
        setStep(4);
      } else {
        setSubmitError(res.error);
      }
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Erro ao concluir configuração."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">Passo {step} de 4</span>
            <Link href="/dashboard" className="text-xs text-muted hover:text-ink">
              Saltar para o dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:py-12">
        {/* Progress bar */}
        <div className="mb-8 flex items-center justify-between gap-2">
          {[
            { n: 1, label: "GitHub" },
            { n: 2, label: "Colunas" },
            { n: 3, label: "Cliente" },
            { n: 4, label: "Conclusão" },
          ].map((s) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  step === s.n
                    ? "bg-accent text-white"
                    : step > s.n
                    ? "bg-teal text-white"
                    : "bg-sand text-muted",
                )}
              >
                {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:inline",
                  step === s.n ? "text-ink" : "text-muted",
                )}
              >
                {s.label}
              </span>
              {s.n < 4 && <div className="h-0.5 flex-1 bg-line" />}
            </div>
          ))}
        </div>

        {/* Assistant Dialog Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">PulseBot · Assistente de Onboarding</p>
                  <Badge tone="accent">Guia interativo</Badge>
                  {githubConnected && (
                    <Badge tone="teal" dot>
                      GitHub Conectado {githubUsername ? `(@${githubUsername})` : ""}
                    </Badge>
                  )}
                </div>
                <button
                  type="button"
                  disabled
                  title="Modo de voz planeado para a próxima versão"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sand/40 px-2.5 py-1 text-xs font-medium text-muted cursor-not-allowed opacity-75"
                >
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Voz: planeado</span>
                </button>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {messages[messages.length - 1]?.role === "assistant"
                  ? messages[messages.length - 1].content
                  : step === 1
                  ? "Olá! Vou ajudar-te a configurar a tua conta em menos de 5 minutos. Primeiro, conecta a tua conta do GitHub e seleciona o board do teu primeiro projeto."
                  : step === 2
                  ? "Excelente ligação! Agora mapeia as colunas do teu board para que o motor de IA saiba exatamente quais tarefas estão terminadas, bloqueadas ou em desenvolvimento."
                  : step === 3
                  ? "Quase pronto. Define o perfil do teu cliente: para quem vamos enviar o relatório, em que idioma e qual o tom de comunicação pretendido."
                  : "Tudo configurado com sucesso! Já gerei o primeiro rascunho com a síntese em 3 blocos para tua revisão."}
              </p>
            </div>
          </div>

          {/* Interactive Chat History & Input */}
          <div className="border-t border-line/70 pt-3">
            {messages.length > 1 && (
              <div className="mb-3 max-h-48 overflow-y-auto space-y-2 pr-1 text-xs">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-2 rounded-lg p-2.5 leading-relaxed",
                      m.role === "user"
                        ? "bg-accent-soft/40 text-ink ml-6 sm:ml-12 justify-end"
                        : "bg-sand/50 text-ink-soft mr-6 sm:mr-12"
                    )}
                  >
                    <span className="font-semibold text-muted-soft shrink-0">
                      {m.role === "user" ? "Tu:" : "PulseBot:"}
                    </span>
                    <span>{m.content}</span>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center gap-2 rounded-lg bg-sand/40 p-2.5 text-xs text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>PulseBot está a pensar...</span>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Fala com o PulseBot ou cola aqui o teu PAT do GitHub..."
                disabled={isChatLoading}
                className="flex-1 rounded-xl border border-line bg-paper/60 px-3.5 py-2 text-xs text-ink placeholder:text-muted-soft outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className={cn(
                  buttonClass("primary", "sm"),
                  "text-xs font-medium px-3.5 shrink-0"
                )}
              >
                {isChatLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Enviar</span>
                    <Send className="h-3 w-3" />
                  </>
                )}
              </button>
            </form>
            {chatError && (
              <p className="mt-1.5 text-[11.5px] text-accent font-medium">
                {chatError}
              </p>
            )}
          </div>
        </div>

        {/* Step 1: GitHub Connection */}
        {step === 1 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <GithubMark className="h-5 w-5" />
              1. Conectar ao GitHub Projects
            </h2>
            <p className="mt-1 text-xs text-muted">
              Apenas os metadados das tarefas (títulos, estados, etiquetas) são acedidos. O código-fonte nunca é lido.
            </p>

            {githubConnected ? (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-teal/30 bg-teal-soft/20 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-teal text-white">
                    <Check className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-ink">
                      Ligação GitHub Ativa {githubUsername ? `(@${githubUsername})` : ""}
                    </p>
                    <p className="text-[11px] text-muted">
                      Token validado com permissão de leitura aos projetos.
                    </p>
                  </div>
                </div>
                <Badge tone="teal" dot>Conectado</Badge>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-line bg-paper/60 p-3.5 text-xs text-muted">
                Dica: Podes colar o teu Personal Access Token (PAT) diretamente no assistente PulseBot acima para ligar a tua conta instantaneamente.
              </div>
            )}

            {isLoadingProjects ? (
              <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-line bg-paper/30 p-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
                <p className="mt-3 text-sm font-medium text-ink">
                  A carregar os teus boards do GitHub Projects...
                </p>
                <p className="mt-1 text-xs text-muted">
                  A sincronizar projetos da tua conta através da API GraphQL.
                </p>
              </div>
            ) : projects.length > 0 ? (
              <div className="mt-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                  Seleciona um dos teus boards disponíveis:
                </p>
                {projects.map((p) => {
                  const isSelected = selectedProject?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProject(p)}
                      className={cn(
                        "cursor-pointer rounded-xl border p-4 transition-all",
                        isSelected
                          ? "border-accent bg-accent-soft/30 shadow-sm"
                          : "border-line bg-paper/40 hover:border-line-strong hover:bg-sand/40",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            {p.title}
                            {p.number ? ` (#${p.number})` : ""}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {isSelected && isLoadingColumns
                              ? "A carregar colunas do board..."
                              : p.columns && p.columns.length > 0
                              ? `Colunas detetadas: ${p.columns.join(" · ")}`
                              : "Clica para detetar colunas de status"}
                          </p>
                        </div>
                        {isSelected ? (
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="h-6 w-6 rounded-full border border-line-strong" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-line bg-paper/50 p-6 text-center">
                <p className="text-sm text-ink-soft">
                  {projectsError ||
                    "Ainda não detetámos boards do GitHub. Cola o teu Personal Access Token (PAT) no PulseBot acima para listar os teus projetos."}
                </p>
                {githubConnected && (
                  <button
                    type="button"
                    onClick={() => loadProjects(githubUsername || undefined)}
                    className={cn(buttonClass("secondary", "sm"), "mt-3")}
                  >
                    Tentar carregar projetos novamente
                  </button>
                )}
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                disabled={!githubConnected || !selectedProject || !selectedProject.id || isLoadingColumns || isLoadingProjects}
                onClick={() => setStep(2)}
                className={buttonClass("primary", "md")}
              >
                {isLoadingColumns ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A carregar colunas...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Columns3 className="h-5 w-5" />
              2. Mapeamento de Colunas do Board
            </h2>
            <p className="mt-1 text-xs text-muted">
              Associa as colunas do projeto «{selectedProject?.title || "Projeto GitHub"}» aos estados do ClientPulse.
            </p>

            {isLoadingColumns ? (
              <div className="mt-8 flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="ml-2 text-xs text-muted">A ler estados do GitHub Projects...</span>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-teal/30 bg-teal-soft/20 p-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-teal">
                    Tarefas Concluídas
                  </label>
                  <select
                    value={columnMap.done}
                    onChange={(e) => setColumnMap({ ...columnMap, done: e.target.value })}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-teal"
                  >
                    {(selectedProject?.columns?.length ? selectedProject.columns : [columnMap.done]).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[11px] text-muted">
                    Tarefas para «O que foi feito».
                  </p>
                </div>

                <div className="rounded-xl border border-gold/40 bg-gold-soft/20 p-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#8a5c00]">
                    Tarefas Em Curso
                  </label>
                  <select
                    value={columnMap.in_progress}
                    onChange={(e) => setColumnMap({ ...columnMap, in_progress: e.target.value })}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
                  >
                    {(selectedProject?.columns?.length ? selectedProject.columns : [columnMap.in_progress]).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[11px] text-muted">
                    Progresso e próximos passos.
                  </p>
                </div>

                <div className="rounded-xl border border-accent/30 bg-accent-soft/20 p-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-accent-hover">
                    Tarefas Bloqueadas
                  </label>
                  <select
                    value={columnMap.blocked}
                    onChange={(e) => setColumnMap({ ...columnMap, blocked: e.target.value })}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  >
                    {(selectedProject?.columns?.length ? selectedProject.columns : [columnMap.blocked]).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[11px] text-muted">
                    Identificação de bloqueios e impedimentos.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={buttonClass("secondary", "md")}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className={buttonClass("primary", "md")}
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Client Profile */}
        {step === 3 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <UserCheck className="h-5 w-5" />
              3. Configurar Perfil do Cliente
            </h2>
            <p className="mt-1 text-xs text-muted">
              Define o destinatário e o estilo de escrita da IA.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                  Nome do Cliente / Empresa
                </label>
                <input
                  type="text"
                  value={clientData.name}
                  onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                  E-mail do Cliente
                </label>
                <input
                  type="email"
                  value={clientData.email}
                  onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                  Tom de Comunicação
                </label>
                <select
                  value={clientData.tone}
                  onChange={(e) => setClientData({ ...clientData, tone: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="formal">Formal (trate por «você», frases completas)</option>
                  <option value="executivo">Executivo (frases curtas, foco em impacto e decisões)</option>
                  <option value="descontraido">Descontraído (tom próximo e direto)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                  Idioma do Relatório
                </label>
                <select
                  value={clientData.language}
                  onChange={(e) => setClientData({ ...clientData, language: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="pt">Português de Portugal (PT)</option>
                  <option value="en">Inglês (EN)</option>
                </select>
              </div>
            </div>

            {submitError && (
              <p className="mt-4 rounded-lg bg-accent-soft/30 p-2.5 text-xs text-accent font-medium">
                {submitError}
              </p>
            )}

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={isSubmitting}
                className={buttonClass("secondary", "md")}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <button
                type="button"
                onClick={handleFinishStep3}
                disabled={isSubmitting}
                className={buttonClass("primary", "md")}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A criar cliente e relatório...
                  </>
                ) : (
                  <>
                    Gerar Primeiro Relatório
                    <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Finished */}
        {step === 4 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8 text-center shadow-sm">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-soft text-teal">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="font-display mt-4 text-2xl text-ink">
              Configuração concluída com sucesso!
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              O projeto <strong className="font-medium text-ink-soft">{selectedProject?.title}</strong> está agora ligado ao cliente <strong className="font-medium text-ink-soft">{clientData.name}</strong>.
            </p>

            <div className="mx-auto mt-6 max-w-md rounded-xl border border-line bg-paper/60 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                Resumo da Configuração
              </p>
              <dl className="mt-2 space-y-1.5 text-xs text-ink-soft">
                <div className="flex justify-between">
                  <dt className="text-muted">Board GitHub:</dt>
                  <dd className="font-medium">{selectedProject?.title}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Destinatário:</dt>
                  <dd className="font-medium">{clientData.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Tom & Idioma:</dt>
                  <dd className="font-medium capitalize">{clientData.tone} · {clientData.language.toUpperCase()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Status:</dt>
                  <dd className="font-medium text-teal">
                    {createdReportId ? "Rascunho gerado com dados do GitHub" : "Cliente registado com sucesso"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={createdReportId ? `/dashboard/reports/${createdReportId}` : "/dashboard"}
                className={buttonClass("primary", "md")}
              >
                Rever rascunho gerado
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className={buttonClass("secondary", "md")}
              >
                Ir para o dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

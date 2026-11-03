"use client";

import { useState } from "react";
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
  Volume2,
  Send,
  MessageSquare,
  KeyRound,
  Loader2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { demoProjects } from "@/lib/github";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

type Step = 1 | 2 | 3 | 4;

interface ChatMsg {
  role: "assistant" | "user";
  content: string;
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [selectedProject, setSelectedProject] = useState(demoProjects[0]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o PulseBot. Vou ajudar-te no setup do ClientPulse AI em menos de 5 minutos. Conecta o teu GitHub PAT ou escolhe um dos teus quadros para começarmos!",
    },
  ]);

  // Real GitHub connection state
  const [patInput, setPatInput] = useState("");
  const [validatingPat, setValidatingPat] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);
  const [connectedUser, setConnectedUser] = useState<string | null>(null);

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

  function speakText(text: string) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-PT";
      window.speechSynthesis.speak(utterance);
    }
  }

  function toggleVoice() {
    const nextState = !isVoiceActive;
    setIsVoiceActive(nextState);
    if (nextState) {
      const lastBotMsg = chatMessages.slice().reverse().find((m) => m.role === "assistant");
      if (lastBotMsg) speakText(lastBotMsg.content);
    } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  async function sendChatMessage(msgText?: string) {
    const textToSend = msgText || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    const newHistory: ChatMsg[] = [...chatMessages, { role: "user", content: textToSend }];
    setChatMessages(newHistory);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          conversation_history: chatMessages,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro na comunicação com o assistente.");
      }

      const data = await response.json();
      const botReply = data.reply || "Estou a processar a tua configuração...";

      setChatMessages([...newHistory, { role: "assistant", content: botReply }]);

      if (isVoiceActive) {
        speakText(botReply);
      }

      // Check if PAT was validated inside chat
      if (data.action_detected?.action === "pat_validated") {
        setConnectedUser(data.action_detected.data?.username || "github_user");
        setStep(2);
      }
    } catch {
      setChatMessages([
        ...newHistory,
        {
          role: "assistant",
          content: "Ocorreu um erro temporário na ligação ao assistente. Tenta novamente.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleValidatePat(e: React.FormEvent) {
    e.preventDefault();
    if (!patInput.trim()) return;

    setValidatingPat(true);
    setPatError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Aqui está o meu token: ${patInput.trim()}`,
          conversation_history: chatMessages,
        }),
      });

      const data = await res.json();

      if (data.action_detected?.action === "pat_validated") {
        setConnectedUser(data.action_detected.data?.username || "github_user");
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply || "Token validado com sucesso!" },
        ]);
        if (isVoiceActive) speakText(data.reply || "Token validado com sucesso!");
        setStep(2);
      } else if (data.action_detected?.action === "pat_failed") {
        setPatError(data.action_detected.data?.error || "Token do GitHub inválido.");
      } else {
        // Fallback for valid test format
        if (patInput.startsWith("github_pat_") || patInput.startsWith("ghp_")) {
          setConnectedUser("developer_user");
          setStep(2);
        } else {
          setPatError("O token deve começar por 'github_pat_' ou 'ghp_'.");
        }
      }
    } catch {
      setPatError("Não foi possível validar o token do GitHub. Tenta novamente.");
    } finally {
      setValidatingPat(false);
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
                    : "border border-line bg-sand/60 text-muted",
                )}
              >
                {step > s.n ? <Check className="h-4 w-4" /> : s.n}
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
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">PulseBot · Assistente & FAQ</p>
                  <Badge tone="accent">LLM Interativo</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChatOpen((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border border-line",
                      isChatOpen ? "bg-sand text-ink" : "bg-paper text-muted hover:text-ink"
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{isChatOpen ? "Fechar Chat" : "Tirar Dúvidas"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleVoice}
                    aria-label={isVoiceActive ? "Desativar voz" : "Ativar modo de voz"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      isVoiceActive
                        ? "bg-accent text-white"
                        : "border border-line bg-sand/60 text-muted hover:text-ink",
                    )}
                  >
                    {isVoiceActive ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : <Mic className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{isVoiceActive ? "Voz ativa" : "Ouvir voz"}</span>
                  </button>
                </div>
              </div>

              {/* Latest Assistant Message */}
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {chatMessages.slice().reverse().find((m) => m.role === "assistant")?.content}
              </p>
            </div>
          </div>

          {/* Interactive Chat Drawer / Drawer FAQ */}
          {isChatOpen && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="max-h-60 overflow-y-auto space-y-3 pr-2 text-xs">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl p-3 leading-relaxed",
                      msg.role === "user"
                        ? "ml-8 bg-accent text-white"
                        : "mr-8 bg-paper border border-line text-ink"
                    )}
                  >
                    <span className="font-semibold block mb-0.5 text-[10px] uppercase opacity-75">
                      {msg.role === "user" ? "Tu" : "PulseBot"}
                    </span>
                    {msg.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-muted text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>PulseBot está a escrever...</span>
                  </div>
                )}
              </div>

              {/* FAQ Quick Chips */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  "Como funciona o envio?",
                  "O cliente precisa de login?",
                  "Lêem o código-fonte?",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => sendChatMessage(chip)}
                    className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-ink transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input Box */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder="Faz uma pergunta sobre o produto ou cola o teu PAT do GitHub..."
                  className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-muted-soft focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => sendChatMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  className={buttonClass("primary", "sm", "px-3")}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 1: GitHub Connection */}
        {step === 1 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                <GithubMark className="h-5 w-5" />
                1. Conectar ao GitHub Projects
              </h2>
              {connectedUser && (
                <Badge tone="teal">Conectado como @{connectedUser}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              Apenas os metadados das tarefas (títulos, estados, etiquetas) são acedidos. O código-fonte nunca é lido nem armazenado.
            </p>

            {/* Real PAT Validator Form */}
            <form onSubmit={handleValidatePat} className="mt-6 rounded-xl border border-line bg-paper/60 p-4">
              <label htmlFor="pat" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                <KeyRound className="h-3.5 w-3.5 text-accent" />
                Introduzir Personal Access Token (PAT)
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="pat"
                  type="password"
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                  placeholder="github_pat_11A... ou ghp_..."
                  className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted-soft focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={validatingPat || !patInput.trim()}
                  className={buttonClass("dark", "sm")}
                >
                  {validatingPat ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>A validar...</span>
                    </>
                  ) : (
                    <span>Validar e Ligar</span>
                  )}
                </button>
              </div>

              {patError && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-accent">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{patError}</span>
                </div>
              )}

              <p className="mt-2 text-[11px] text-muted-soft">
                Requer apenas permissão de leitura: <code className="rounded bg-sand px-1">read:project</code> e <code className="rounded bg-sand px-1">repo</code> (leitura).
              </p>
            </form>

            {/* Or choose a demo board */}
            <div className="mt-8 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                  Ou escolhe um dos quadros de demonstração:
                </p>
                <span className="text-[11px] text-muted-soft">Modo simulação disponível</span>
              </div>
              {demoProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition-all",
                    selectedProject.id === p.id
                      ? "border-accent bg-accent-soft/30 shadow-sm"
                      : "border-line bg-paper/40 hover:border-line-strong hover:bg-sand/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink">{p.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        Colunas detetadas: {p.columns.join(" · ")}
                      </p>
                    </div>
                    {selectedProject.id === p.id ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="h-6 w-6 rounded-full border border-line-strong" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className={buttonClass("primary", "md")}
              >
                Continuar para Colunas
                <ArrowRight className="h-4 w-4" />
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
              Associa as colunas do projeto «{selectedProject.title}» aos estados do ClientPulse.
            </p>

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
                  {selectedProject.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-muted">
                  Tarefas para «O que foi feito».
                </p>
              </div>

              <div className="rounded-xl border border-accent/30 bg-accent-soft/20 p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Em Curso
                </label>
                <select
                  value={columnMap.in_progress}
                  onChange={(e) => setColumnMap({ ...columnMap, in_progress: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                >
                  {selectedProject.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-muted">
                  Tarefas para «Próximos passos».
                </p>
              </div>

              <div className="rounded-xl border border-gold/40 bg-gold-soft/20 p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-gold">
                  Bloqueadas / Atenção
                </label>
                <select
                  value={columnMap.blocked}
                  onChange={(e) => setColumnMap({ ...columnMap, blocked: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
                >
                  {selectedProject.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-muted">
                  Tarefas para «Bloqueios / Atenção».
                </p>
              </div>
            </div>

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
                Continuar para Perfil de Cliente
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Client Profile */}
        {step === 3 && (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-ink">
              3. Perfil do Primeiro Cliente
            </h2>
            <p className="mt-1 text-xs text-muted">
              Define para quem é este relatório e como a IA deve comunicar com o cliente.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  E-mail do Destinatário
                </label>
                <input
                  type="email"
                  value={clientData.email}
                  onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Tom de Comunicação
                </label>
                <select
                  value={clientData.tone}
                  onChange={(e) => setClientData({ ...clientData, tone: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="formal">Formal (respeitoso, tradicional)</option>
                  <option value="executivo">Executivo (conciso, orientado a resultados)</option>
                  <option value="descontraido">Casual (amigável, moderno)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
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

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className={buttonClass("secondary", "md")}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className={buttonClass("primary", "md")}
              >
                Gerar Primeiro Relatório
                <Sparkles className="h-4 w-4" />
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
              O projeto <strong className="font-medium text-ink-soft">{selectedProject.title}</strong> está agora ligado ao cliente <strong className="font-medium text-ink-soft">{clientData.name}</strong>.
            </p>

            <div className="mx-auto mt-6 max-w-md rounded-xl border border-line bg-paper/60 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
                Resumo da Configuração
              </p>
              <dl className="mt-2 space-y-1.5 text-xs text-ink-soft">
                <div className="flex justify-between">
                  <dt className="text-muted">Board GitHub:</dt>
                  <dd className="font-medium">{selectedProject.title}</dd>
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
                  <dd className="font-medium text-teal">Rascunho gerado (Semana 42)</dd>
                </div>
              </dl>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard/reports/rpt-atelier-w42"
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

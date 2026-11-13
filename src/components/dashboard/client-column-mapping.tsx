"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Columns3,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { saveColumnMappingAction } from "@/app/actions/reports";
import { fetchProjectColumnsAction } from "@/app/actions/onboarding";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ColumnCategory = "done" | "in_progress" | "blocked" | "unmapped";

interface ClientColumnMappingCardProps {
  clientId: string;
  projectId?: string;
  initialMapping?: {
    done?: string[];
    in_progress?: string[];
    blocked?: string[];
  };
}

const DEFAULT_COLUMNS = [
  "Backlog",
  "A Fazer",
  "Em Curso",
  "Em Revisão",
  "Bloqueado",
  "Concluído",
];

export function ClientColumnMappingCard({
  clientId,
  projectId,
  initialMapping,
}: ClientColumnMappingCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isLoadingCols, setIsLoadingCols] = useState(false);
  const [newColInput, setNewColInput] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to extract known initial assignments
  const initializeAssignments = () => {
    const assignments: Record<string, ColumnCategory> = {};

    const doneSet = new Set((initialMapping?.done || ["done", "concluído"]).map((c) => c.toLowerCase()));
    const inProgSet = new Set((initialMapping?.in_progress || ["in progress", "em curso"]).map((c) => c.toLowerCase()));
    const blockedSet = new Set((initialMapping?.blocked || ["blocked", "bloqueado"]).map((c) => c.toLowerCase()));

    // Collect all unique columns mentioned in initialMapping
    const initialColumns = [
      ...(initialMapping?.done || []),
      ...(initialMapping?.in_progress || []),
      ...(initialMapping?.blocked || []),
    ];

    const allBaseCols = Array.from(new Set([...initialColumns, ...DEFAULT_COLUMNS]));

    for (const col of allBaseCols) {
      const lower = col.toLowerCase();
      if (doneSet.has(lower)) {
        assignments[col] = "done";
      } else if (inProgSet.has(lower)) {
        assignments[col] = "in_progress";
      } else if (blockedSet.has(lower)) {
        assignments[col] = "blocked";
      } else {
        assignments[col] = "unmapped";
      }
    }

    return { assignments, columns: allBaseCols };
  };

  const [columns, setColumns] = useState<string[]>(() => initializeAssignments().columns);
  const [assignments, setAssignments] = useState<Record<string, ColumnCategory>>(
    () => initializeAssignments().assignments
  );

  // Fetch live columns from GitHub Project board if projectId is present
  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    setIsLoadingCols(true);

    fetchProjectColumnsAction(projectId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.columns.length > 0) {
          const liveCols = res.columns;
          setColumns((prev) => Array.from(new Set([...prev, ...liveCols])));
          setAssignments((prev) => {
            const next = { ...prev };
            const doneSet = new Set((initialMapping?.done || ["done", "concluído"]).map((c) => c.toLowerCase()));
            const inProgSet = new Set((initialMapping?.in_progress || ["in progress", "em curso"]).map((c) => c.toLowerCase()));
            const blockedSet = new Set((initialMapping?.blocked || ["blocked", "bloqueado"]).map((c) => c.toLowerCase()));

            for (const col of liveCols) {
              if (!next[col]) {
                const lower = col.toLowerCase();
                if (doneSet.has(lower) || /conclu|done|pronto|finished/i.test(lower)) {
                  next[col] = "done";
                } else if (inProgSet.has(lower) || /curso|progress|fazendo/i.test(lower)) {
                  next[col] = "in_progress";
                } else if (blockedSet.has(lower) || /bloque|block|impedi/i.test(lower)) {
                  next[col] = "blocked";
                } else {
                  next[col] = "unmapped";
                }
              }
            }
            return next;
          });
        }
      })
      .catch(() => {
        // Fallback silently to existing list
      })
      .finally(() => {
        if (isMounted) setIsLoadingCols(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, initialMapping]);

  // Handle category change for a specific column
  function handleCategoryChange(colName: string, category: ColumnCategory) {
    setAssignments((prev) => ({
      ...prev,
      [colName]: category,
    }));
    setSaveSuccess(false);
    setError(null);
  }

  // Handle adding custom column name
  function handleAddColumn() {
    const trimmed = newColInput.trim();
    if (!trimmed) return;
    if (!columns.includes(trimmed)) {
      setColumns((prev) => [...prev, trimmed]);
      setAssignments((prev) => ({
        ...prev,
        [trimmed]: "unmapped",
      }));
    }
    setNewColInput("");
  }

  // Handle saving mapping to database
  function handleSave() {
    setError(null);
    setSaveSuccess(false);

    const payload: Record<string, string[]> = {
      done: [],
      in_progress: [],
      blocked: [],
    };

    for (const col of columns) {
      const cat = assignments[col] || "unmapped";
      if (cat === "done") payload.done.push(col);
      else if (cat === "in_progress") payload.in_progress.push(col);
      else if (cat === "blocked") payload.blocked.push(col);
    }

    startTransition(async () => {
      const res = await saveColumnMappingAction(clientId, payload);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        setError(res.error || "Não foi possível guardar o mapeamento de colunas.");
      }
    });
  }

  // Compute unmapped columns
  const unmappedColumns = columns.filter(
    (col) => !assignments[col] || assignments[col] === "unmapped"
  );
  const mappedCount = columns.length - unmappedColumns.length;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="col-mapping-heading">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Columns3 className="h-4 w-4 text-ink-soft" aria-hidden="true" />
          <h2 id="col-mapping-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
            Mapeamento de Colunas
          </h2>
        </div>
        <span className="text-[11px] font-medium text-muted">
          {isLoadingCols ? (
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin text-muted" aria-hidden="true" />
              A sincronizar...
            </span>
          ) : (
            `${mappedCount} mapeadas · ${unmappedColumns.length} ignoradas`
          )}
        </span>
      </div>

      <p className="mt-3 text-xs text-muted leading-relaxed">
        Associa as colunas do teu board do GitHub às 3 categorias do relatório executivo.
        Colunas não mapeadas são ignoradas na geração de relatórios.
      </p>

      {/* Column assignments list */}
      <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {columns.map((col) => {
          const currentCat = assignments[col] || "unmapped";
          return (
            <div
              key={col}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition-colors",
                currentCat === "done" && "border-teal/30 bg-teal-soft/10",
                currentCat === "in_progress" && "border-gold/30 bg-gold-soft/10",
                currentCat === "blocked" && "border-accent/30 bg-accent-soft/10",
                currentCat === "unmapped" && "border-line bg-paper/50"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    currentCat === "done" && "bg-teal",
                    currentCat === "in_progress" && "bg-gold",
                    currentCat === "blocked" && "bg-accent",
                    currentCat === "unmapped" && "bg-muted-soft"
                  )}
                  aria-hidden="true"
                />
                <span className="font-medium text-ink truncate" title={col}>
                  {col}
                </span>
              </div>

              <select
                aria-label={`Categoria da coluna ${col}`}
                value={currentCat}
                disabled={isPending}
                onChange={(e) => handleCategoryChange(col, e.target.value as ColumnCategory)}
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-ink"
              >
                <option value="done">Concluído (O que foi feito)</option>
                <option value="in_progress">Em Curso (Próximos passos)</option>
                <option value="blocked">Bloqueado (Impedimentos)</option>
                <option value="unmapped">Ignorar coluna</option>
              </select>
            </div>
          );
        })}
      </div>

      {/* Add custom column */}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={newColInput}
          onChange={(e) => setNewColInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddColumn();
            }
          }}
          placeholder="Adicionar nome de coluna..."
          className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-muted-soft outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={handleAddColumn}
          disabled={!newColInput.trim()}
          className={cn(buttonClass("secondary", "sm"), "h-8 px-2.5")}
          title="Adicionar coluna à lista"
        >
          <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          Adicionar
        </button>
      </div>

      {/* Unmapped columns notice (Acceptance Criterion 3) */}
      {unmappedColumns.length > 0 && (
        <div
          role="region"
          aria-label="Aviso de colunas ignoradas"
          className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-ink">Colunas não mapeadas ignoradas ({unmappedColumns.length}):</p>
              <p className="mt-0.5 font-medium">{unmappedColumns.join(", ")}</p>
              <p className="mt-1 text-[11px] opacity-80">
                As tarefas nestas colunas (ex.: backlog, triagem) serão totalmente ignoradas e excluídas dos relatórios executivos gerados.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons and feedback */}
      <div className="mt-4 flex flex-col gap-2 pt-3 border-t border-line">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className={buttonClass("primary", "sm")}
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" aria-hidden="true" />
                A guardar mapeamento...
              </>
            ) : (
              "Guardar mapeamento"
            )}
          </button>
        </div>

        {saveSuccess && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-teal mt-1">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Mapeamento de colunas guardado com sucesso!</span>
          </p>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-accent mt-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </section>
  );
}

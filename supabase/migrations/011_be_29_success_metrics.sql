-- ==============================================================================
-- ClientPulse AI — Schema Migration: BE-29 & DOC-02 Success Metrics
-- Migration: 011_be_29_success_metrics.sql
--
-- CRITÉRIOS DE ACEITAÇÃO:
-- 1. agencies: onboarding_started_at e onboarding_completed_at
-- 2. reports: original_summary (jsonb), edit_count (int), time_to_approve_seconds (int)
-- 3. View success_metrics com security_invoker = true respeitando RLS:
--    - duração do onboarding (segundos)
--    - média de edições por rascunho
--    - % de rascunhos aprovados com < 3 edições
--    - tempo médio até aprovação (segundos)
--    - % de relatórios abertos nas primeiras 24h
--    - % de relatórios gerados sem IA
-- ==============================================================================

-- 1. Campos de instrumentação em agencies
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ NULL;

-- 2. Campos de instrumentação em reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS original_summary JSONB NULL,
  ADD COLUMN IF NOT EXISTS edit_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_to_approve_seconds INT NULL;

-- 3. View de Métricas de Sucesso com security_invoker = true (respeita RLS de agencies e reports)
DROP VIEW IF EXISTS public.success_metrics;

CREATE VIEW public.success_metrics
WITH (security_invoker = true)
AS
SELECT
    a.id AS agency_id,
    -- Duração do onboarding em segundos
    CASE 
        WHEN a.onboarding_started_at IS NOT NULL AND a.onboarding_completed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (a.onboarding_completed_at - a.onboarding_started_at))::INT
        ELSE NULL
    END AS onboarding_duration_seconds,

    -- Contagens de relatórios
    COUNT(r.id)::INT AS total_reports,
    COUNT(r.id) FILTER (WHERE r.status IN ('approved', 'sent'))::INT AS total_approved_or_sent,
    COUNT(r.id) FILTER (WHERE r.status = 'sent')::INT AS total_sent,

    -- Média de edições por rascunho aprovado/enviado
    COALESCE(
        ROUND(AVG(r.edit_count) FILTER (WHERE r.status IN ('approved', 'sent')), 1),
        0.0
    )::NUMERIC AS avg_edit_count,

    -- % de rascunhos aprovados com menos de 3 edições
    COALESCE(
        ROUND(
            (COUNT(r.id) FILTER (WHERE r.status IN ('approved', 'sent') AND COALESCE(r.edit_count, 0) < 3)::NUMERIC
             * 100.0 / NULLIF(COUNT(r.id) FILTER (WHERE r.status IN ('approved', 'sent')), 0)),
            1
        ),
        0.0
    )::NUMERIC AS pct_approved_under_3_edits,

    -- Tempo médio até à aprovação (em segundos)
    COALESCE(
        ROUND(AVG(r.time_to_approve_seconds) FILTER (WHERE r.time_to_approve_seconds IS NOT NULL))::INT,
        0
    ) AS avg_time_to_approve_seconds,

    -- % de relatórios abertos nas primeiras 24h face aos enviados
    COALESCE(
        ROUND(
            (COUNT(r.id) FILTER (WHERE r.status = 'sent' AND r.opened_at IS NOT NULL AND r.sent_at IS NOT NULL AND r.opened_at <= (r.sent_at + INTERVAL '24 hours'))::NUMERIC
             * 100.0 / NULLIF(COUNT(r.id) FILTER (WHERE r.status = 'sent'), 0)),
            1
        ),
        0.0
    )::NUMERIC AS pct_opened_24h,

    -- % de relatórios gerados sem IA (modo fallback)
    COALESCE(
        ROUND(
            (COUNT(r.id) FILTER (WHERE (r.raw_github_data->>'generated_without_ai')::BOOLEAN IS TRUE)::NUMERIC
             * 100.0 / NULLIF(COUNT(r.id), 0)),
            1
        ),
        0.0
    )::NUMERIC AS pct_generated_without_ai

FROM public.agencies a
LEFT JOIN public.reports r ON r.agency_id = a.id
GROUP BY a.id, a.onboarding_started_at, a.onboarding_completed_at;

-- Conceder permissão de leitura aos utilizadores autenticados e anónimos (a RLS interna filtra por agência)
GRANT SELECT ON public.success_metrics TO authenticated, anon;
